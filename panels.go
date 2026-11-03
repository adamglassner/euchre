//go:build !headless

package main

import (
	"image"
	"image/color"
	"math"
	"strings"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/colorm"
)

/* ---------------- a simple top-to-bottom layout ---------------- */

// col lays content out down a column. The first pass only measures
// (draw == false); the second draws.
type col struct {
	g    *game
	p    pen
	draw bool
	x, w float64 // content box
	y    float64
	clip *image.Rectangle
}

func (c *col) cx() float64 { return c.x + c.w/2 }

func (c *col) line(str string, f font, clr color.Color, lh float64, align int) {
	if c.draw {
		x := c.x
		switch align {
		case alignC:
			x = c.cx()
		case alignR:
			x = c.x + c.w
		}
		c.p.rich(str, f, x, base(f, c.y, lh), clr, align)
	}
	c.y += lh
}

func (c *col) spacedLine(str string, f font, em float64, clr color.Color, lh float64) {
	if c.draw {
		c.p.spaced(str, f, c.cx(), base(f, c.y, lh), em, clr, alignC)
	}
	c.y += lh
}

func (c *col) para(str string, f font, clr color.Color, lh float64, align int) {
	for _, l := range wrap(str, f, c.w) {
		c.line(l, f, clr, lh, align)
	}
}

func (c *col) button(id, label string, w float64, st btnStyle, f font, padY float64) {
	h := st.border*2 + padY*2 + f.size*1.2
	x := c.cx() - w/2
	if c.draw {
		dy, _ := c.g.button(c.p, id, x, c.y, w, h, st)
		c.g.ui.hits[len(c.g.ui.hits)-1].clip = c.clip
		c.p.text(label, f, c.cx(), base(f, c.y+dy+st.border+padY, f.size*1.2), st.ink, alignC)
	}
	c.y += h + st.ledge
}

type rowBtn struct {
	id, label string
	st        btnStyle
}

// buttonRow draws big buttons side by side, centred.
func (c *col) buttonRow(f font, padY float64, bs []rowBtn) {
	h := 3*2 + padY*2 + f.size*1.2
	total := -14.0
	ws := make([]float64, len(bs))
	for i, b := range bs {
		ws[i] = measure(b.label, f) + 72 + 6
		total += ws[i] + 14
	}
	if c.draw {
		x := c.cx() - total/2
		for i, b := range bs {
			dy, _ := c.g.button(c.p, b.id, x, c.y, ws[i], h, b.st)
			c.g.ui.hits[len(c.g.ui.hits)-1].clip = c.clip
			c.p.text(b.label, f, x+ws[i]/2, base(f, c.y+dy+3+padY, f.size*1.2), b.st.ink, alignC)
			x += ws[i] + 14
		}
	}
	c.y += h + 5
}

// rich text with <b> and <i> runs, wrapped to the column
type span struct {
	s   string
	f   font
	clr color.Color
}

func markup(s string, size float64, clr color.Color) []span {
	var out []span
	bold, ital := false, false
	for s != "" {
		i := strings.IndexByte(s, '<')
		if i < 0 {
			i = len(s)
		}
		if i > 0 {
			f := body(size, 400)
			if bold {
				f.wght = 700
			}
			if ital {
				f.k = fItal
			}
			out = append(out, span{s[:i], f, clr})
			s = s[i:]
			continue
		}
		j := strings.IndexByte(s, '>')
		switch s[1:j] {
		case "b":
			bold = true
		case "/b":
			bold = false
		case "i":
			ital = true
		case "/i":
			ital = false
		}
		s = s[j+1:]
	}
	return out
}

func (c *col) flow(spans []span, lh, indent float64) {
	type tok struct {
		s   string
		f   font
		clr color.Color
		sp  bool
	}
	var toks []tok
	space := false
	for _, sp := range spans {
		word := ""
		flush := func() {
			if word != "" {
				toks = append(toks, tok{word, sp.f, sp.clr, space})
				word, space = "", false
			}
		}
		for _, r := range sp.s {
			if r == ' ' {
				flush()
				space = true
				continue
			}
			word += string(r)
		}
		flush()
	}
	// group tokens that touch (no space between) so they never split
	var words [][]tok
	for i, t := range toks {
		if i == 0 || t.sp {
			words = append(words, []tok{t})
		} else {
			words[len(words)-1] = append(words[len(words)-1], t)
		}
	}
	width := func(w []tok) float64 {
		s := 0.0
		for _, t := range w {
			s += richWidth(t.s, t.f)
		}
		return s
	}
	maxW := c.w - indent
	var line [][]tok
	lineW := 0.0
	emit := func() {
		if c.draw {
			x := c.x + indent
			for i, w := range line {
				if i > 0 {
					x += measure(" ", w[0].f)
				}
				for _, t := range w {
					c.p.rich(t.s, t.f, x, base(t.f, c.y, lh), t.clr, alignL)
					x += richWidth(t.s, t.f)
				}
			}
		}
		c.y += lh
		line, lineW = nil, 0
	}
	for _, w := range words {
		ww := width(w)
		sw := 0.0
		if len(line) > 0 {
			sw = measure(" ", w[0].f)
		}
		if len(line) > 0 && lineW+sw+ww > maxW {
			emit()
			sw = 0
		}
		line = append(line, w)
		lineW += sw + ww
	}
	if len(line) > 0 {
		emit()
	}
}

/* ---------------- panels ---------------- */

// panel draws a veil over the window and a centred cream panel w wide,
// scrolling when its content is taller than the window allows.
func (g *game) panel(p pen, w float64, content func(c *col)) {
	u := &g.ui
	w = math.Min(w, u.winW*0.92)
	cw := w - 8 - 88
	m := &col{g: g, p: p, x: 0, w: cw}
	content(m)
	full := 4 + 26 + m.y + 22 + 4
	ph := math.Min(full, u.winH*0.94)
	u.scrollMax = full - ph
	u.scroll = clamp(u.scroll, 0, u.scrollMax)
	x, y := math.Round((u.winW-w)/2), math.Round((u.winH-ph)/2)

	p.rect(0, 0, u.winW, u.winH, color.NRGBA{40, 20, 8, 153})
	g.addHit(hit{id: "veil", x: 0, y: 0, w: u.winW, h: u.winH})
	p.soft(x, y+30, w, ph, 14, 80, 0.6)
	p.box(x, y, w, ph, 14, 4, cPaper, cBrown, 7, 0)
	// gingham trim along the top
	clip := image.Rect(int((x+4)*u.ds), int((y+4)*u.ds), int((x+w-4)*u.ds), int((y+ph-4)*u.ds))
	cp := pen{dst: p.dst.SubImage(clip).(*ebiten.Image), s: p.s}
	sy := y + 4 - u.scroll
	cp.rr(x+4, sy, w-8, 14, 10, hexc("f6efe0", 1))
	red := color.NRGBA{168, 36, 32, 191}
	for xx := x + 4; xx < x+w-4; xx += 14 {
		cp.rect(xx, sy, math.Min(7, x+w-4-xx), 14, red)
	}
	cp.rect(x+4, sy, w-8, 7, red)
	cp.rect(x+4, sy+14, w-8, 1, cPaper)
	hc := image.Rect(int(x+4), int(y+4), int(x+w-4), int(y+ph-4))
	c := &col{g: g, p: cp, draw: true, x: x + 4 + 44, w: cw, y: y + 4 + 26 - u.scroll, clip: &hc}
	content(c)
	if u.scrollMax > 0 { // a slim scrollbar
		th := (ph - 8) * ph / full
		ty := y + 4 + (ph-8-th)*u.scroll/u.scrollMax
		p.rr(x+w-12, ty, 5, th, 2.5, color.NRGBA{90, 52, 23, 110})
	}
}

/* ---------------- title card ---------------- */

func (g *game) drawTitle(p pen) {
	rec := g.recordText()
	w := math.Max(600, measure(rec, italic(14, 600))+96)
	g.panel(p, w, func(c *col) {
		c.y += 6
		c.spacedLine("FRIDAY NIGHT · KITCHEN TABLE", slab(13), 0.14, cMuted, 15.6)
		c.y += 4
		if c.draw {
			b := base(slab(82), c.y, 82)
			c.p.text("Euchre", slab(82), c.cx(), b+4, cMaroon, alignC)
			c.p.text("Euchre", slab(82), c.cx(), b, cBarn, alignC)
		}
		c.y += 82 + 8
		c.line("A Midwest Card Game", italic(21, 700), cSub, 28.35, alignC)
		c.y += 8 + 6
		// a fan of bowers
		if c.draw {
			ids := []string{"D11", "H11", "S14", "C13", "H12"}
			bottom := c.y + 150
			for _, i := range []int{0, 2, 3, 4, 1} {
				cb := bottom
				if i == 1 {
					cb -= 12
				}
				px, py := c.cx(), cb-126+151.2
				th := float64(i-2) * 13 * math.Pi / 180
				cx, cy := px+88.2*math.Sin(th), py-88.2*math.Cos(th)
				c.p.cardImg(ids[i], cx, cy, 90, float64(i-2)*13)
			}
		}
		c.y += 150 + 4
		// the folks
		type tfolk struct{ who, txt string }
		nf := g.nextFolks
		folks := []tfolk{{"barb", "Partner: Aunt Barb"}, {"", "vs"}, {"dale", "Uncle Dale"}, {"june", "Grandma June"}}
		if len(nf) == 3 {
			folks = []tfolk{{nf[0].face, "Partner: " + nf[0].full}, {"", "vs"}, {nf[1].face, nf[1].full}, {nf[2].face, nf[2].full}}
		}
		lf := body(13, 700)
		ws := make([]float64, len(folks))
		total := 0.0
		for i, f := range folks {
			if f.who == "" {
				ws[i] = measure("vs", slab(18))
			} else {
				ws[i] = math.Max(58, measure(f.txt, lf))
			}
			total += ws[i]
		}
		total += 18 * float64(len(folks)-1)
		c.y += 4
		fh := 58 + 17.55
		if c.draw {
			x := c.cx() - total/2
			for i, f := range folks {
				mx := x + ws[i]/2
				if f.who == "" {
					c.p.text("vs", slab(18), mx, base(slab(18), c.y, fh), cMuted, alignC)
				} else {
					c.p.cameo(f.who, mx, c.y+29, 58, nil)
					c.p.text(f.txt, lf, mx, base(lf, c.y+58, 17.55), cSub, alignC)
				}
				x += ws[i] + 18
			}
		}
		c.y += fh + 10 + 4
		// options
		type opt struct {
			label, key string
			vals       [][2]string
		}
		st := g.save.Settings
		opts := []opt{
			{"Play to", "target", [][2]string{{"5", "5"}, {"10", "10"}}},
			{"Stick the dealer", "stick", [][2]string{{"1", "On"}, {"0", "Off"}}},
			{"Pace", "speed", [][2]string{{"relaxed", "Easy"}, {"normal", "Regular"}, {"brisk", "Quick"}}},
		}
		cur := map[string]string{"target": itoa(st.Target), "stick": itoa(st.Stick), "speed": st.Speed}
		of, chf := italic(13, 700), body(15, 700)
		chipsW := func(o opt) float64 {
			w := 4.0 + 2*float64(len(o.vals)-1)
			for _, v := range o.vals {
				w += measure(v[1], chf) + 26
			}
			return w
		}
		gw := make([]float64, len(opts))
		total = 0
		for i, o := range opts {
			gw[i] = math.Max(measure(o.label, of), chipsW(o))
			total += gw[i]
		}
		total += 20 * float64(len(opts)-1)
		chH := 2 + 5 + 20.25 + 5 + 2
		if c.draw {
			x := c.cx() - total/2
			for i, o := range opts {
				mx := x + gw[i]/2
				c.p.text(o.label, of, mx, base(of, c.y, 17.55), cSub2, alignC)
				cw := chipsW(o)
				cx := mx - cw/2
				cy := c.y + 17.55 + 4
				c.p.rr(cx, cy, cw, chH, 8, cBrown)
				bx := cx + 2
				for j, v := range o.vals {
					bw := measure(v[1], chf) + 26
					id := "opt:" + o.key + "=" + v[0]
					on := cur[o.key] == v[0]
					fill, ink := hexc("fffdf5", 1), cInk
					if on {
						fill, ink = cBarn, cWhite
					} else if g.ui.hover == id {
						fill = cWhite
					}
					r := 0.0
					if j == 0 || j == len(o.vals)-1 {
						r = 6
					}
					c.p.rr(bx, cy+2, bw, chH-4, r, fill)
					if j > 0 && j < len(o.vals)-1 || (j == 0 && len(o.vals) > 1) || (j == len(o.vals)-1 && len(o.vals) > 1) {
						// square off the inner corners
						if j > 0 {
							c.p.rect(bx, cy+2, bw/2, chH-4, fill)
						}
						if j < len(o.vals)-1 {
							c.p.rect(bx+bw/2, cy+2, bw/2, chH-4, fill)
						}
					}
					c.p.text(v[1], chf, bx+bw/2, base(chf, cy+2+5, 20.25), ink, alignC)
					g.addHit(hit{id: id, x: bx, y: cy, w: bw, h: chH, ptr: true, clip: c.clip})
					bx += bw + 2
				}
				x += gw[i] + 20
			}
		}
		c.y += 17.55 + 4 + chH + 16 + 4
		c.buttonRow(slab(26), 10, []rowBtn{{"start", "Deal 'Em", stBig}, {"together", "Play Together", stGhost}})
		c.y += 14
		// links
		lf2 := body(15, 700)
		l1, l2, dot := "How to Play", "Credits & Changelog", "  ·  "
		tw := measure(l1, lf2) + measure(dot, lf2) + measure(l2, lf2)
		if c.draw {
			x := c.cx() - tw/2
			b := base(lf2, c.y, 20.25)
			for _, l := range []struct{ id, s string }{{"how", l1}, {"", dot}, {"credits", l2}} {
				lw := measure(l.s, lf2)
				if l.id == "" {
					c.p.text(l.s, lf2, x, b, cSub2, alignL)
				} else {
					col := cBarn
					if g.ui.hover == l.id {
						col = cBarn2
					}
					c.p.text(l.s, lf2, x, b, col, alignL)
					c.p.rect(x, b+2, lw, 1.3, col)
					g.addHit(hit{id: l.id, x: x, y: c.y, w: lw, h: 20.25, ptr: true, clip: c.clip})
				}
				x += lw
			}
		}
		c.y += 20.25 + 10
		c.line(rec, italic(14, 600), cSub2, 18.9, alignC)
		c.y += 12
		// "An [Ironite] game"
		if c.draw {
			bf := italic(14, 600)
			lb := art.logo.Bounds()
			lw := 22 * float64(lb.Dx()) / float64(lb.Dy())
			tw := measure("An", bf) + 8 + lw + 8 + measure("game", bf)
			x := c.cx() - tw/2
			b := base(bf, c.y, 22)
			c.p.text("An", bf, x, b, cSub2, alignL)
			x += measure("An", bf) + 8
			var cm colorm.ColorM
			cm.Scale(0, 0, 0, 1)
			cm.Translate(0x24/255.0, 0x45/255.0, 0x2f/255.0, 0)
			var m ebiten.GeoM
			m.Scale(lw/float64(lb.Dx()), 22/float64(lb.Dy()))
			m.Translate(x, c.y)
			c.p.drawImgCM(art.logo, m, cm)
			x += lw + 8
			c.p.text("game", bf, x, b, cSub2, alignL)
		}
		c.y += 22
	})
}

/* ---------------- how to play ---------------- */

var rulesText = []string{
	"<b>The deal.</b> Everyone gets 5 cards. The other 4 make the kitty, and its top card is turned face up.",
	"<b>Making trump.</b> Starting left of the dealer, each player can <b>order up</b> the face-up card (its suit becomes trump and the dealer picks it up, then discards one) or <b>pass</b>. If everyone passes, the card is turned down and each player may <b>name</b> any other suit, or pass. With <i>stick the dealer</i>, the dealer has to name one.",
	"<b>The bowers.</b> The Jack of trump is the <b>right bower</b> (the highest card). The other Jack of the same colour is the <b>left bower</b> (second highest) and counts as trump. Then A, K, Q, 10, 9 of trump.",
	"<b>Playing.</b> The player left of the dealer leads. You must follow suit if you can; otherwise play anything, including trump. The highest trump wins the trick, or else the highest card of the suit led. The winner leads next.",
	"<b>Scoring.</b> The team that made trump scores 1 point for 3 or 4 tricks and 2 for all 5 (a <b>march</b>). If they take fewer than 3, they're <b>euchred</b> and the other team scores 2.",
	"<b>Going alone.</b> Whoever makes trump can go alone; their partner sits out. A lone march is worth 4 points.",
}

func (c *col) h3(s string) {
	c.y += 8
	c.line(s, slab(28), cBarn, 33.6, alignC)
	c.y += 10
}

func (g *game) drawRules(p pen) {
	g.panel(p, 640, func(c *col) {
		c.h3("How to Play Euchre")
		c.y += 16
		c.flow(markup("Four players in two teams: <b>you and your partner</b> (across the table) against the <b>two folks on either side</b>. The deck is just the 9s through Aces: 24 cards.", 16, cInk), 21.6, 0)
		c.y += 16
		for i, t := range rulesText {
			c.y += 6
			if c.draw {
				c.p.text(itoa(i+1)+".", body(16, 400), c.x+22-5, base(body(16, 400), c.y, 21.6), cInk, alignR)
			}
			c.flow(markup(t, 16, cInk), 21.6, 22)
			c.y += 6
		}
		c.y += 16
		c.para("Keys: F2 new game · M music on/off · F11 full screen", body(14, 400), hexc("7a6048", 1), 18.9, alignL)
		c.y += 16 + 16
		c.button("closeRules", "You Betcha", measure("You Betcha", slab(20))+56+6, stBig, slab(20), 7)
	})
}

/* ---------------- credits & changelog ---------------- */

func (g *game) drawCredits(p pen) {
	g.panel(p, 640, func(c *col) {
		c.h3("Credits")
		rows := [][2]string{
			{"Developed & Published by", "Ironite"}, {"Game Design", "Ironite"}, {"Card Art & Illustration", "Ironite"},
			{"Music", "Ironite"}, {"", ""}, {"Sound Effects", "Ironite"}, {"Typefaces", "Alfa Slab One & Bitter (SIL Open Font License)"},
		}
		lf, rf := italic(16, 400), body(16, 700)
		for _, r := range rows {
			if r[0] == "" { // the tune list
				var t []string
				for _, n := range art.tunes {
					t = append(t, "“"+n+"”")
				}
				tf := italic(14, 400)
				for _, l := range wrap(strings.Join(t, ", "), tf, c.w-18) {
					if c.draw {
						c.p.text(l, tf, c.x+18, base(tf, c.y, 18.9), cSub2, alignL)
					}
					c.y += 18.9
				}
				c.y += 4
				continue
			}
			c.y += 5
			if c.draw {
				b := base(rf, c.y, 21.6)
				c.p.text(r[0], lf, c.x, b, cSub2, alignL)
				c.p.text(r[1], rf, c.x+c.w, b, cInk, alignR)
			}
			c.y += 21.6 + 5
			if c.draw {
				c.p.dashH(c.x, c.x+c.w, c.y, color.NRGBA{90, 52, 23, 102})
			}
			c.y++
		}
		c.y += 14
		c.para("Copyright © 2026 Ironite. All rights reserved.", body(14, 400), hexc("7a6048", 1), 18.9, alignL)
		c.y += 14
		c.h3("Changelog")
		any := false
		for _, l := range strings.Split(strings.ReplaceAll(art.changelog, "\r", ""), "\n") {
			switch {
			case strings.HasPrefix(l, "## "):
				any = true
				c.y += 12
				c.line(strings.NewReplacer("[", "", "]", "").Replace(l[3:]), slab(19), cBarn, 22.8, alignL)
				c.y += 2
			case strings.HasPrefix(l, "### "):
				c.y += 8
				if c.draw {
					c.p.spaced(strings.ToUpper(l[4:]), slab(13), c.x, base(slab(13), c.y, 15.6), 0.06, cMuted, alignL)
				}
				c.y += 15.6 + 2
			case strings.HasPrefix(l, "- "):
				f := body(15, 400)
				c.y += 2
				if c.draw {
					c.p.circle(c.x+11, base(f, c.y, 20.25)-4.5, 2.6, cInk)
				}
				c.flow([]span{{l[2:], f, cInk}}, 20.25, 20)
				c.y += 2
			}
		}
		if !any {
			c.para("No changes recorded.", body(14, 400), hexc("7a6048", 1), 18.9, alignL)
		}
		c.y += 16
		c.button("closeCredits", "Close", measure("Close", slab(20))+56+6, stBig, slab(20), 7)
	})
}

/* ---------------- result ---------------- */

func (g *game) drawResult(p pen) {
	r := g.result
	w := math.Max(560, math.Max(measure(r.rec, italic(14, 600)), measure(r.title, slab(64)))+96)
	g.panel(p, w, func(c *col) {
		c.y += 6
		c.spacedLine(strings.ToUpper(r.kick), slab(13), 0.14, cMuted, 15.6)
		c.y += 4
		if c.draw {
			b := base(slab(64), c.y, 64)
			c.p.text(r.title, slab(64), c.cx(), b+4, cMaroon, alignC)
			c.p.text(r.title, slab(64), c.cx(), b, cBarn, alignC)
		}
		c.y += 64 + 8
		c.line(r.sub, italic(21, 700), cSub, 28.35, alignC)
		c.y += 8 + 10
		if c.draw {
			f, nf := slab(20), slab(40)
			cols := []struct {
				l string
				n int
				c color.NRGBA
			}{{r.l1, r.us, cDenim}, {r.l2, r.them, cBarn}}
			ws := []float64{math.Max(measure(r.l1, f), measure(itoa(r.us), nf)), math.Max(measure(r.l2, f), measure(itoa(r.them), nf))}
			x := c.cx() - (ws[0]+ws[1]+26)/2
			for i, k := range cols {
				mx := x + ws[i]/2
				c.p.text(k.l, f, mx, base(f, c.y, 24), k.c, alignC)
				c.p.text(itoa(k.n), nf, mx, base(nf, c.y+24, 48), k.c, alignC)
				x += ws[i] + 26
			}
		}
		c.y += 24 + 48 + 4 + 10
		c.line(r.rec, italic(14, 600), cSub2, 18.9, alignC)
		c.y += 16
		switch g.mode {
		case ModeClient:
			c.y += 4
			c.line("Waiting for the host to deal again…", italic(15, 600), cSub2, 20.25, alignC)
			c.y += 12
			c.buttonRow(slab(26), 10, []rowBtn{{"leave", "Leave Game", stGhost}})
		case ModeHost:
			c.buttonRow(slab(26), 10, []rowBtn{{"again", "Deal Again", stBig}, {"leave", "Close Game", stGhost}})
		default:
			c.buttonRow(slab(26), 10, []rowBtn{{"again", "Play Again", stBig}, {"toMenu", "Kitchen", stGhost}})
		}
	})
}
