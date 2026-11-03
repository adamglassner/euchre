package main

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	eu "github.com/adamglassner/euchre/internal/euchre"
)

/* ---------------- who's at the table ---------------- */

// Kind says who plays a seat.
type Kind int

const (
	KindAI     Kind = iota // a computer player
	KindLocal              // someone at this computer
	KindRemote             // someone playing over the network
)

// Mode is how this game is being played.
type Mode int

const (
	ModeSolo    Mode = iota // you and three computer folks
	ModeHotseat             // 2-4 people sharing this computer
	ModeHost                // hosting an online game
	ModeClient              // playing in someone else's online game
)

// Seats as drawn: the viewer always sits at the bottom (S), the next player
// to their left (W), their partner across (N) and the last to their right (E).
const (
	seatS = 'S'
	seatW = 'W'
	seatN = 'N'
	seatE = 'E'
)

var seatOrder = [4]byte{seatS, seatW, seatN, seatE}

type player struct {
	i          int
	kind       Kind
	face       string // cameo id, "" for none
	name, full string // "Barb", "Aunt Barb"
	hand       []*cardV
	sitOut     bool
	say        string
	sayAt      time.Time
	sayEnd     time.Time
	turnAt     time.Time
	isTurn     bool
	peer       *peer
}

type play struct {
	p    int
	card *cardV
}

/* ---------------- where a card is ---------------- */

type zoneK int

const (
	zNone    zoneK = iota
	zDeck          // the shuffled pile by the dealer
	zHand          // in player P's hand, position N
	zKitty         // the kitty in the middle
	zUp            // the turned-up card
	zDown          // the up card, turned down
	zDiscard       // the dealer's discard
	zTidy          // the kitty, tidied off to the dealer's side
	zPlay          // played to the trick by P (N = order)
	zWon           // in the tricks P won (M = trick number, N = card)
)

type zone struct {
	K zoneK   `json:"k"`
	P int     `json:"p,omitempty"`
	N int     `json:"n,omitempty"`
	M int     `json:"m,omitempty"`
	J float64 `json:"j,omitempty"` // a little random rotation
}

type cardV struct {
	c   eu.Card
	id  string // "H11"; "" when this computer doesn't know the face
	idx int
	tok int // what guests call this card (shuffled every hand)
	zn  zone
	// position animation (table coordinates, card centre)
	fx, fy, fr, fs, tx, ty, tr, ts float64
	t0                             time.Time
	dur                            float64
	placed                         bool
	// flip animation: 0 = face up, 180 = face down
	fa0, fa1 float64
	ft0      time.Time
	fdur     float64
	z        int
	speed    int // 0 normal, 1 fast, 2 instant
	pick     bool
	dim      bool
	win      bool
	out      bool
	lift     float64
	x, y     float64
}

func (c *cardV) pos(now time.Time) (x, y, r, s float64) {
	if c.dur <= 0 {
		return c.tx, c.ty, c.tr, c.ts
	}
	t := easeCard(now.Sub(c.t0).Seconds() / c.dur)
	l := func(a, b float64) float64 { return a + (b-a)*t }
	return l(c.fx, c.tx), l(c.fy, c.ty), l(c.fr, c.tr), l(c.fs, c.ts)
}

func (c *cardV) angle(now time.Time) float64 {
	if c.fdur <= 0 {
		return c.fa1
	}
	t := easeInOut(now.Sub(c.ft0).Seconds() / c.fdur)
	return c.fa0 + (c.fa1-c.fa0)*t
}

/* ---------------- game state ---------------- */

type askBtn struct {
	Label string  `json:"label"`
	Sub   string  `json:"sub,omitempty"`
	V     eu.Suit `json:"v,omitempty"`
	Yes   bool    `json:"yes,omitempty"`
	Cls   string  `json:"cls,omitempty"` // "", "pass", "suit"
}

type askT struct {
	q, sub string
	btns   []askBtn
	toggle bool
	lone   bool
	at     time.Time
	ch     chan askRes
}

type askRes struct {
	btn   askBtn
	idx   int
	alone bool
}

type waitT struct {
	ok  []*cardV
	all []*cardV
	ch  chan *cardV
}

type bannerT struct {
	title, small string
	blue         bool
	at, until    time.Time
}

type particle struct {
	k                        int // 0 pop, 1 spark, 2 confetti
	x, y, vx, vy, life, d, s float64
	rot, vr                  float64
	col                      int
}

type resultT struct {
	kick, title, sub string
	l1, l2           string // "Us" / "Them"
	us, them         int
	rec              string
	won              bool
}

type game struct {
	mu sync.Mutex

	save    saveData
	mode    Mode
	viewer  int  // whose seat the table is drawn from
	hidden  bool // shared computer: hands face down between turns
	players [4]*player
	deck    []*cardV
	byCard  map[eu.Card]*cardV
	byTok   [24]*cardV

	dealer, maker int
	trump         eu.Suit
	alone         bool
	up            *cardV
	turnedDown    bool
	trick         []play
	led           eu.Suit
	played        map[eu.Card]bool
	score, tricks [2]int
	target        int
	handNo        int

	gameID   int
	cancel   chan struct{}
	finished bool
	started  bool
	wait     *waitT
	ask      *askT
	remote   *remoteWait
	prompt   string
	promptAt time.Time
	ban      bannerT
	tSuit    string
	tRed     int // 0 none, 1 red, 2 black
	tSub     string
	pace     float64
	parts    []particle

	// team tallies this game, for guests' records
	teamTally [2]tally
	loners    [4]int

	// layout, in logical pixels (table space)
	Wd, Ht, cw, ch float64

	// overlays
	showTitle, showRules, showCredits, showResult bool
	showTogether, showHotseat, showOnline         bool
	showLobby                                     bool
	passTo                                        int
	passCh                                        chan struct{}
	message                                       string
	result                                        resultT
	resultAt                                      time.Time
	ui                                            uiState

	setup  setupState
	focus  string // text field being typed in
	server *server
	client *client
	lobby  []lobbySeat
	cliEnd chan struct{} // closed to drop a guest's pending ask

	nextFolks []folk // who sits down for the next single-player game

	rng *rand.Rand
}

type tally struct{ Hands, Euchres, Marches int }

var errCancel = fmt.Errorf("cancelled")

func newGameState() *game {
	g := &game{rng: rand.New(rand.NewSource(time.Now().UnixNano())), pace: 1, dealer: 0, maker: -1, showTitle: true}
	g.save = loadSave()
	g.setup = newSetup(&g.save)
	g.target = g.save.Settings.Target
	g.resetDeck(false)
	g.soloTable()
	g.nextFolks = nil // the first game seats the folks already at the table
	for _, i := range []int{2, 1, 3} {
		p := g.players[i]
		g.nextFolks = append(g.nextFolks, folk{face: p.face, name: p.name, full: p.full})
	}
	g.Wd, g.Ht = 1400, 820
	g.measure()
	g.showTrump()
	return g
}

// resetDeck makes the 24 cards. A guest's cards start out unknown.
func (g *game) resetDeck(guest bool) {
	g.deck = nil
	g.byCard = map[eu.Card]*cardV{}
	for i, c := range eu.Deck() {
		v := &cardV{c: c, id: c.ID(), idx: i, tok: i, ts: 1, fs: 1, fa1: 180}
		if guest {
			v.id = ""
		}
		g.deck = append(g.deck, v)
		g.byCard[c] = v
		g.byTok[i] = v
	}
}

func (g *game) rand(n int) int      { return g.rng.Intn(n) }
func pickS[T any](g *game, a []T) T { return a[g.rand(len(a))] }

/* pacing */
var paceOf = map[string]float64{"relaxed": 1.35, "normal": 1, "brisk": 0.6}

func (g *game) T(k string) float64 {
	v := map[string]float64{"deal": 70, "move": 420, "play": 380, "think": 650, "trick": 900, "bid": 700, "quip": 1900, "banner": 1700}[k]
	v *= g.pace
	if testFast {
		v *= 0.06
	}
	return v
}

// sleep releases the table while waiting; a new game cancels the old one.
func (g *game) sleep(ms float64) {
	id, cancel := g.gameID, g.cancel
	g.mu.Unlock()
	select {
	case <-time.After(time.Duration(ms * float64(time.Millisecond))):
	case <-cancel:
	}
	g.mu.Lock()
	if id != g.gameID {
		panic(errCancel)
	}
}

// waitOn releases the table until ch delivers (or the game is cancelled).
func waitOn[T any](g *game, ch chan T) T {
	id, cancel := g.gameID, g.cancel
	g.mu.Unlock()
	var v T
	select {
	case v = <-ch:
	case <-cancel:
	}
	g.mu.Lock()
	if id != g.gameID {
		panic(errCancel)
	}
	return v
}

/* ---------------- rules helpers ---------------- */

func (g *game) eff(c *cardV) eu.Suit { return eu.EffSuit(c.c, g.trump) }

func (g *game) trickPlays() []eu.Play {
	t := make([]eu.Play, len(g.trick))
	for i, x := range g.trick {
		t[i] = eu.Play{P: x.p, Card: x.card.c}
	}
	return t
}

func cardsOf(h []*cardV) []eu.Card {
	out := make([]eu.Card, len(h))
	for i, c := range h {
		out[i] = c.c
	}
	return out
}

func (g *game) legal(p *player) []*cardV {
	var out []*cardV
	for _, c := range eu.Legal(cardsOf(p.hand), g.trickPlays(), g.trump, g.led) {
		out = append(out, g.byCard[c])
	}
	return out
}

func (g *game) winning() (int, *cardV) {
	w, _ := eu.Winning(g.trickPlays(), g.trump, g.led)
	return w.P, g.byCard[w.Card]
}

func team(i int) int { return eu.Team(i) }

func (g *game) aiPlay(p *player) *cardV {
	c := eu.ChoosePlay(eu.PlayState{Seat: p.i, Maker: g.maker, Hand: cardsOf(p.hand), Trick: g.trickPlays(), Trump: g.trump, Led: g.led, Played: g.played})
	return g.byCard[c]
}

/* ---------------- names, as each seat sees them ---------------- */

// who is how player i is named to the person in seat v ("you" or a name).
func (g *game) who(i, v int) string {
	if i == v && g.mode != ModeHotseat {
		return "you"
	}
	return g.players[i].name
}

func (g *game) Who(i, v int) string {
	s := g.who(i, v)
	if s == "you" {
		return "You"
	}
	return s
}

func (g *game) partnerName(i int) string { return g.players[eu.PartnerOf(i)].name }

/* ---------------- layout ---------------- */

func (g *game) measure() {
	g.ch = math.Max(96, math.Min(math.Min(g.Ht*0.215, g.Wd*0.13), 220))
	g.cw = g.ch * cardW / cardH
}

func (g *game) cy() float64 { return g.Ht * 0.47 }

func (g *game) seatOf(i int) byte { return seatOrder[((i-g.viewer)%4+4)%4] }

func (g *game) anchor(seat byte) (float64, float64) {
	switch seat {
	case seatS:
		return g.Wd / 2, g.Ht - g.ch*0.6 - 4
	case seatN:
		return g.Wd / 2, g.ch*0.58 + 4
	case seatW:
		return g.ch*0.6 + 6, g.cy()
	}
	return g.Wd - g.ch*0.6 - 6, g.cy()
}

func (g *game) handPos(seat byte, i, n int) (x, y, r float64) {
	ax, ay := g.anchor(seat)
	k := float64(i) - float64(n-1)/2
	switch seat {
	case seatS:
		sp := g.cw * 0.74
		return ax + k*sp, ay + k*k*2.2, k * 4.5
	case seatN:
		sp := g.cw * 0.42
		return ax - k*sp, ay - k*k*1.4, 180 - k*3.5
	}
	sp, dir := g.cw*0.42, 1.0
	if seat == seatE {
		dir = -1
	}
	return ax - dir*k*k*1.4, ay + dir*k*sp, dir*90 + dir*k*3.5
}

func (g *game) playSpot(seat byte) (float64, float64, float64) {
	x, y, d := g.Wd/2, g.cy(), g.ch*0.42
	switch seat {
	case seatS:
		return x, y + d, -3
	case seatN:
		return x, y - d, 183
	case seatW:
		return x - g.cw*0.9, y, 87
	}
	return x + g.cw*0.9, y, -86
}

// zonePos is where a card in a zone sits, as the viewer sees the table.
func (g *game) zonePos(c *cardV) (x, y, r, s float64, up bool, z int) {
	zn := c.zn
	N := float64(zn.N)
	switch zn.K {
	case zDeck:
		dx, dy := g.anchor(g.seatOf(g.dealer))
		sx, sy := (dx+g.Wd/2)/2, (dy+g.cy())/2
		return sx + N*0.2, sy - N*0.3, zn.J, 1, false, 20 + zn.N
	case zHand:
		p := g.players[zn.P]
		x, y, r := g.handPos(g.seatOf(zn.P), zn.N, len(p.hand))
		s := 1.0
		if p.sitOut {
			s = 0.9
		}
		return x, y, r, s, zn.P == g.viewer && !g.hidden, 100 + zn.N
	case zKitty:
		return g.Wd/2 - g.cw*0.12 + N*1.5, g.cy() - N*1.5, -6, 1, false, 40 + zn.N
	case zUp:
		return g.Wd/2 + g.cw*0.18, g.cy() + 4, 4, 1, true, 60
	case zDown:
		return g.Wd/2 + g.cw*0.18 - g.cw*0.3, g.cy(), -6, 1, false, 44
	case zDiscard:
		return g.Wd/2 - g.cw*0.1, g.cy() - 6, -8, 1, false, 45
	case zTidy:
		ax, ay := g.anchor(g.seatOf(g.dealer))
		kx := g.Wd/2 + (ax-g.Wd/2)*0.42
		if s := g.seatOf(g.dealer); s == seatN || s == seatS {
			kx += g.cw * 1.6
		}
		ky := g.cy() + (ay-g.cy())*0.42
		return kx + N, ky - N, 12, 0.62, false, 30 + zn.N
	case zPlay:
		sx, sy, sr := g.playSpot(g.seatOf(zn.P))
		return sx, sy, sr + zn.J, 1, true, 300 + zn.N
	case zWon:
		ax, ay := g.anchor(g.seatOf(zn.P))
		tx, ty := g.Wd/2+(ax-g.Wd/2)*0.62, g.cy()+(ay-g.cy())*0.62
		rot := 0.0
		if s := g.seatOf(zn.P); s == seatW || s == seatE {
			rot = 90
		}
		return tx + float64(zn.M)*6 + N, ty - N, rot, 0.55, false, 20 + zn.N
	}
	return c.tx, c.ty, c.tr, c.ts, false, c.z
}

// layoutCards moves every card to where its zone says (animated unless instant).
func (g *game) layoutCards(instant bool) {
	for _, c := range g.deck {
		if c.zn.K == zNone {
			continue
		}
		x, y, r, s, up, z := g.zonePos(c)
		sp := c.speed
		if instant {
			c.speed = 2
		}
		if !c.placed || x != c.tx || y != c.ty || r != c.tr || s != c.ts || z != c.z {
			g.place(c, x, y, r, z, s)
		}
		g.flip(c, up && c.id != "")
		c.speed = sp
		c.out = c.zn.K == zHand && g.players[c.zn.P].sitOut
	}
}

func (g *game) place(c *cardV, x, y, r float64, z int, scale float64) {
	now := time.Now()
	c.fx, c.fy, c.fr, c.fs = c.pos(now)
	c.tx, c.ty, c.tr, c.ts = x, y, r, scale
	c.x, c.y = x, y
	c.t0 = now
	switch c.speed {
	case 0:
		c.dur = 0.42
	case 1:
		c.dur = 0.22
	default:
		c.dur = 0
	}
	if !c.placed { // first placement: appear in place rather than fly in from the corner
		c.dur, c.placed = 0, true
	}
	if z >= 0 {
		c.z = z
	}
}

func (g *game) flip(c *cardV, up bool) {
	now := time.Now()
	target := 180.0
	if up {
		target = 0
	}
	if c.fa1 == target {
		return
	}
	c.fa0, c.fa1, c.ft0 = c.angle(now), target, now
	c.fdur = 0.36
	if c.speed == 2 {
		c.fdur = 0
	}
}

// setHand gives every card in p's hand its zone (after the hand changes).
func (g *game) setHand(p *player) {
	for i, c := range p.hand {
		c.zn = zone{K: zHand, P: p.i, N: i}
	}
}

func (g *game) sortHand(p *player) {
	cs := cardsOf(p.hand)
	eu.SortHand(cs, g.trump)
	for i, c := range cs {
		p.hand[i] = g.byCard[c]
	}
	g.setHand(p)
}

// sync lays the table out here and sends every guest their view of it.
func (g *game) sync() {
	g.layoutCards(false)
	g.showTrump()
	if g.server != nil {
		g.server.sendSnaps(g, false)
	}
}

func (g *game) setTurn(i int) {
	for _, p := range g.players {
		on := p.i == i
		if on && !p.isTurn {
			p.turnAt = time.Now()
		}
		p.isTurn = on
	}
}

func (g *game) setPrompt(t string) {
	if t != g.prompt {
		g.promptAt = time.Now()
	}
	g.prompt = t
}

func (g *game) banner(title, small string, blue bool, ms float64) {
	if ms == 0 {
		ms = 1700 * g.pace
		if testFast {
			ms *= 0.2
		}
	}
	now := time.Now()
	g.ban = bannerT{title, small, blue, now, now.Add(time.Duration(ms) * time.Millisecond)}
}

// trumpView is the trump box as seat v sees it.
func (g *game) trumpView(v int) (string, int, string) {
	switch {
	case g.trump != eu.NoSuit:
		red := 2
		if g.trump.Red() {
			red = 1
		}
		sub := fmt.Sprintf("%s · called by %s", g.trump.Name(), g.who(g.maker, v))
		if g.alone {
			sub += " (alone)"
		}
		return g.trump.Symbol(), red, sub
	case g.up != nil && g.turnedDown:
		return "?", 0, g.up.c.S.Name() + " turned down"
	case g.up != nil:
		return "?", 0, "Up card: " + g.up.c.Label()
	}
	return "–", 0, "Shuffling…"
}

func (g *game) showTrump() {
	if g.mode == ModeClient {
		return // a guest gets the trump box from the host
	}
	g.tSuit, g.tRed, g.tSub = g.trumpView(g.viewer)
}

/* ---------------- events everyone sees (each worded for their seat) ---------------- */

type event struct {
	K    string  `json:"k"`
	P    int     `json:"p,omitempty"`
	N    int     `json:"n,omitempty"`
	Text string  `json:"text,omitempty"`
	Sub  string  `json:"sub,omitempty"`
	Blue bool    `json:"blue,omitempty"`
	Ms   float64 `json:"ms,omitempty"`
}

// emit shows an event here and sends it to every guest, worded for their seat.
func (g *game) emit(f func(v int) *event) {
	if e := f(g.viewer); e != nil {
		g.apply(e)
	}
	if g.server != nil {
		for _, pr := range g.server.peers {
			if e := f(pr.seat); e != nil {
				pr.send(Msg{T: "ev", Ev: e})
			}
		}
	}
}

func (g *game) emitAll(e event) { g.emit(func(int) *event { c := e; return &c }) }

func (g *game) sound(name string) { g.emitAll(event{K: "snd", Text: name}) }

func (g *game) apply(e *event) {
	switch e.K {
	case "snd":
		snd.play(e.Text)
	case "say":
		if e.P < 0 || e.P > 3 || g.players[e.P] == nil {
			return
		}
		p := g.players[e.P]
		now := time.Now().Add(time.Duration(e.Ms) * time.Millisecond)
		p.say, p.sayAt, p.sayEnd = e.Text, now, now.Add(time.Duration(g.T("quip")+500)*time.Millisecond)
	case "banner":
		g.banner(e.Text, e.Sub, e.Blue, e.Ms)
	case "spark":
		x, y, _ := g.playSpot(g.seatOf(e.P))
		g.burst(x, y, 1, 12)
	case "pop":
		if e.Text == "low" {
			g.burst(g.Wd/2, g.Ht*0.8, 0, e.N)
		} else {
			g.burst(g.Wd/2, g.cy(), 0, e.N)
		}
	case "confetti":
		g.burst(0, 0, 2, e.N)
	case "prompt":
		g.setPrompt(e.Text)
	}
}

// say has a computer player say one of their lines.
func (g *game) say(p *player, kind string, chance float64, s eu.Suit, delay float64) {
	f := faceByID[p.face]
	if p.kind != KindAI || f == nil || g.rng.Float64() > chance || len(f.lines[kind]) == 0 {
		return
	}
	line := pickS(g, f.lines[kind])
	if s != eu.NoSuit {
		line = strings.ReplaceAll(line, "{s}", strings.ToLower(s.Name()))
		line = strings.ReplaceAll(line, "{S}", s.Name())
	}
	line = strings.ReplaceAll(line, "{p}", g.partnerName(p.i))
	g.emitAll(event{K: "say", P: p.i, Text: line, Ms: delay})
}

/* ---------------- effects ---------------- */

func (g *game) burst(x, y float64, kind int, n int) {
	R := g.rng.Float64
	for i := 0; i < n; i++ {
		switch kind {
		case 0:
			a, v := -math.Pi/2+(R()-.5)*2.2, 3+R()*6
			g.parts = append(g.parts, particle{k: 0, x: x, y: y, vx: math.Cos(a) * v, vy: math.Sin(a) * v, life: 1, d: 0.009, s: 5 + R()*5, rot: R() * 6, vr: (R() - .5) * .3})
		case 1:
			a, v := R()*math.Pi*2, 1.5+R()*4
			g.parts = append(g.parts, particle{k: 1, x: x, y: y, vx: math.Cos(a) * v, vy: math.Sin(a)*v - 1, life: 1, d: 0.02 + R()*0.02, s: 2 + R()*3})
		case 2:
			g.parts = append(g.parts, particle{k: 2, x: R() * g.Wd, y: -20 - R()*g.Ht*0.5, vx: (R() - .5) * 2, vy: 2 + R()*2.5, life: 1, d: 0.003, s: 6 + R()*6, rot: R() * 6, vr: (R() - .5) * .25, col: g.rand(6)})
		}
	}
}

/* ---------------- decisions: here, over the network, or the computer ---------------- */

func (g *game) chooseCard(ok, all []*cardV, text string) *cardV {
	g.setPrompt(text)
	in := func(c *cardV) bool {
		for _, x := range ok {
			if x == c {
				return true
			}
		}
		return false
	}
	for _, c := range all {
		c.pick, c.dim = in(c), !in(c)
	}
	w := &waitT{ok: ok, all: all, ch: make(chan *cardV, 1)}
	g.wait = w
	defer func() {
		for _, x := range all {
			x.pick, x.dim = false, false
		}
		g.setPrompt("")
	}()
	return waitOn(g, w.ch)
}

func (g *game) askUser(q, sub string, btns []askBtn, toggle bool) askRes {
	a := &askT{q: q, sub: sub, btns: btns, toggle: toggle, at: time.Now(), ch: make(chan askRes, 1)}
	g.ask = a
	return waitOn(g, a.ch)
}

// localTurn is true when someone at this computer decides for seat i.
func (g *game) localTurn(i int) bool { return g.players[i].kind == KindLocal && !autopilot }

// ensureView turns a shared computer over to the player in seat i: a
// "pass the computer" screen while everyone's cards are face down, then the
// table turns to their seat.
func (g *game) ensureView(i int) {
	if g.mode != ModeHotseat || (g.viewer == i && !g.hidden) {
		return
	}
	if g.viewer != i {
		g.hidden = true
		g.sync()
		g.passTo = i
		ch := make(chan struct{}, 1)
		g.passCh = ch
		func() {
			defer func() { g.passCh = nil }()
			waitOn(g, ch)
		}()
		g.viewer = i
	}
	g.hidden = false
	g.sync()
	g.sleep(g.T("move"))
}

func (g *game) hideAfter() {
	if g.mode == ModeHotseat {
		g.hidden = true
		g.sync()
	}
}

func (g *game) bid1Ask(i int) (string, string, []askBtn) {
	up := g.up
	verb, yes := "Order up", "Order it up"
	sub := fmt.Sprintf("%s would be trump and %s picks it up.", up.c.S.Name(), g.who(g.dealer, i))
	if i == g.dealer {
		verb, yes = "Pick up", "Pick it up"
		sub = up.c.S.Name() + " would be trump."
	}
	return verb + " the " + up.c.Label() + "?", sub, []askBtn{{Label: yes, Yes: true}, {Label: "Pass", Cls: "pass"}}
}

func (g *game) decideBid1(i int) (call, alone bool) {
	p := g.players[i]
	q, sub, btns := g.bid1Ask(i)
	switch {
	case g.localTurn(i):
		g.ensureView(i)
		r := g.askUser(q, sub, btns, true)
		g.hideAfter()
		return r.btn.Yes, r.btn.Yes && r.alone
	case p.kind == KindRemote:
		if a, ok := g.remoteAsk(i, &wireAsk{K: "bid", Q: q, Sub: sub, Btns: btns, Toggle: true}); ok {
			b := btns[a.Btn]
			return b.Yes, b.Yes && a.Alone
		}
	}
	g.sleep(g.T("bid"))
	return eu.Bid1(cardsOf(p.hand), i, g.dealer, g.up.c)
}

func (g *game) decideBid2(i int, stuck bool) (eu.Suit, bool) {
	p := g.players[i]
	turned := g.up.c.S
	var btns []askBtn
	for _, x := range eu.Suits {
		if x != turned {
			btns = append(btns, askBtn{Label: x.Symbol(), Sub: x.Name(), V: x, Cls: "suit"})
		}
	}
	q, sub := "Name trump", "(anything but "+turned.Name()+")"
	if stuck {
		q, sub = "Stuck!", "The dealer has to name trump."
	} else {
		btns = append(btns, askBtn{Label: "Pass", Cls: "pass"})
	}
	switch {
	case g.localTurn(i):
		g.ensureView(i)
		r := g.askUser(q, sub, btns, true)
		g.hideAfter()
		return r.btn.V, r.btn.V != eu.NoSuit && r.alone
	case p.kind == KindRemote:
		if a, ok := g.remoteAsk(i, &wireAsk{K: "bid", Q: q, Sub: sub, Btns: btns, Toggle: true}); ok {
			b := btns[a.Btn]
			return b.V, b.V != eu.NoSuit && a.Alone
		}
	}
	g.sleep(g.T("bid"))
	return eu.Bid2(cardsOf(p.hand), turned, stuck)
}

func (g *game) decideCard(i int, ok []*cardV, text string, think float64, ai func() *cardV) *cardV {
	p := g.players[i]
	switch {
	case g.localTurn(i):
		g.ensureView(i)
		c := g.chooseCard(ok, p.hand, text)
		g.hideAfter()
		return c
	case p.kind == KindRemote:
		a := &wireAsk{K: "card", Prompt: text}
		for _, c := range ok {
			a.Toks = append(a.Toks, c.tok)
		}
		if r, okk := g.remoteAsk(i, a); okk {
			return g.byTok[r.Tok]
		}
	}
	g.sleep(think)
	return ai()
}

/* ---------------- dealing & bidding ---------------- */

// soloTable seats you with the three folks the title card shows (your
// partner across, the others either side) and picks who comes next time.
func (g *game) soloTable() {
	g.mode, g.viewer, g.hidden = ModeSolo, 0, false
	if len(g.nextFolks) != 3 {
		g.rollNext()
	}
	g.players[0] = &player{i: 0, kind: KindLocal, name: "You", full: "You"}
	for k, seat := range []int{2, 1, 3} {
		f := g.nextFolks[k]
		g.players[seat] = &player{i: seat, kind: KindAI, face: f.face, name: f.name, full: f.full}
	}
	g.rollNext()
}

func (g *game) rollNext() { g.nextFolks = randomFolks(g.rng, 3, map[string]bool{}, map[string]bool{}) }

// fillFolks gives every empty or computer seat a random folk.
func (g *game) fillFolks() {
	faces, names := map[string]bool{}, map[string]bool{}
	for _, p := range g.players {
		if p != nil && p.kind != KindAI {
			faces[p.face], names[p.name] = true, true
		}
	}
	var open []int
	for i, p := range g.players {
		if p == nil || p.kind == KindAI {
			open = append(open, i)
		}
	}
	fs := randomFolks(g.rng, len(open), faces, names)
	for k, i := range open {
		f := fs[k%len(fs)]
		g.players[i] = &player{i: i, kind: KindAI, face: f.face, name: f.name, full: f.full}
	}
}

func (g *game) setPlayer(i int, kind Kind, face, name string) *player {
	p := &player{i: i, kind: kind, face: face, name: name, full: name}
	g.players[i] = p
	return p
}

// newGame is called with the lock held.
func (g *game) newGame() {
	g.gameID++
	if g.cancel != nil {
		close(g.cancel)
	}
	g.cancel = make(chan struct{})
	g.finished, g.started = false, true
	g.pace = paceOf[g.save.Settings.Speed]
	if g.pace == 0 {
		g.pace = 1
	}
	if g.mode == ModeSolo { // a new set of folks every game
		g.soloTable()
	}
	g.target = g.save.Settings.Target
	g.showResult, g.wait, g.ask, g.remote, g.passCh = false, nil, nil, nil, nil
	g.prompt = ""
	g.ban = bannerT{}
	g.parts = nil
	for _, p := range g.players {
		p.hand, p.sitOut, p.isTurn, p.say = nil, false, false, ""
	}
	if g.mode == ModeHotseat {
		g.viewer, g.hidden = 0, true
	}
	for _, c := range g.deck {
		c.speed, c.pick, c.dim, c.win, c.out = 2, false, false, false, false
		c.zn = zone{}
	}
	g.score, g.tricks = [2]int{}, [2]int{}
	g.teamTally, g.loners = [2]tally{}, [4]int{}
	g.dealer, g.trump, g.maker, g.up = g.rand(4), eu.NoSuit, -1, nil
	g.showTrump()
	if g.server != nil {
		g.server.open = false
		g.server.sendSnaps(g, true)
	}
	go g.run(g.gameID)
}

func (g *game) run(id int) {
	g.mu.Lock()
	defer func() {
		if r := recover(); r != nil && r != errCancel {
			g.mu.Unlock()
			panic(r)
		}
		g.mu.Unlock()
	}()
	if id != g.gameID {
		return
	}
	for max(g.score[0], g.score[1]) < g.target {
		g.playHand()
		g.dealer = (g.dealer + 1) % 4
	}
	g.endGame()
}

func (g *game) playHand() {
	g.trump, g.maker, g.alone, g.up, g.trick, g.led, g.turnedDown = eu.NoSuit, -1, false, nil, nil, eu.NoSuit, false
	g.played, g.tricks = map[eu.Card]bool{}, [2]int{}
	g.handNo++
	for _, p := range g.players {
		p.hand, p.sitOut = nil, false
	}
	g.setTurn(-1)
	// guests know a card only by a token that changes every hand
	for i, t := range g.rng.Perm(24) {
		g.deck[i].tok = t
		g.byTok[t] = g.deck[i]
	}
	deck := append([]*cardV(nil), g.deck...)
	for i := len(deck) - 1; i > 0; i-- {
		j := g.rand(i + 1)
		deck[i], deck[j] = deck[j], deck[i]
	}
	for i, c := range deck {
		c.speed, c.win, c.out, c.pick, c.dim = 1, false, false, false, false
		c.zn = zone{K: zDeck, N: i, J: (g.rng.Float64() - .5) * 4}
	}
	g.sync()
	g.sound("shuffle")
	d := g.dealer
	g.emit(func(v int) *event {
		if g.who(d, v) == "you" {
			return &event{K: "prompt", Text: "You deal…"}
		}
		return &event{K: "prompt", Text: g.players[d].name + " deals…"}
	})
	g.sleep(g.T("move") * 1.6)
	k := 0
	for _, round := range [][4]int{{3, 2, 3, 2}, {2, 3, 2, 3}} {
		for j := 0; j < 4; j++ {
			p := g.players[(g.dealer+1+j)%4]
			for n := 0; n < round[j]; n++ {
				p.hand = append(p.hand, deck[k])
				k++
			}
			g.sortHand(p)
			g.sync()
			g.sound("deal")
			g.sleep(g.T("deal") * 1.6)
		}
	}
	kitty := deck[20:]
	g.up = kitty[0]
	for i, c := range kitty {
		c.zn = zone{K: zKitty, N: i}
	}
	g.sync()
	g.sleep(g.T("move"))
	g.up.zn = zone{K: zUp}
	for _, c := range deck {
		c.speed = 0
	}
	g.sync()
	g.sound("flip")
	g.emitAll(event{K: "prompt"})
	g.sleep(g.T("move"))
	if !g.bidding() {
		g.emitAll(event{K: "banner", Text: "Misdeal!", Sub: "Everybody passed. Next dealer.", Blue: true})
		g.sleep(g.T("banner"))
		return
	}
	g.playTricks()
}

func (g *game) bidding() bool {
	for j := 1; j <= 4; j++ {
		i := (g.dealer + j) % 4
		p := g.players[i]
		g.setTurn(i)
		g.sync()
		call, alone := g.decideBid1(i)
		if call {
			if p.kind == KindAI {
				kind := "order"
				if alone {
					kind = "alone"
				}
				g.say(p, kind, 1, eu.NoSuit, 0)
			} else {
				g.sound("tick")
			}
			g.makeTrump(i, g.up.c.S, alone, true)
			return true
		}
		g.say(p, "pass", 0.8, eu.NoSuit, 0)
		g.sound("pass")
	}
	// turn it down
	g.up.zn = zone{K: zDown}
	g.turnedDown = true
	g.sync()
	g.sound("flip")
	g.sleep(g.T("move"))
	for j := 1; j <= 4; j++ {
		i := (g.dealer + j) % 4
		p := g.players[i]
		stuck := i == g.dealer && g.save.Settings.Stick == 1
		g.setTurn(i)
		g.sync()
		s, alone := g.decideBid2(i, stuck)
		if s != eu.NoSuit {
			if p.kind == KindAI {
				kind := "call"
				if alone {
					kind = "alone"
				}
				g.say(p, kind, 1, s, 0)
			}
			g.makeTrump(i, s, alone, false)
			return true
		}
		g.say(p, "pass", 0.8, eu.NoSuit, 0)
		g.sound("pass")
	}
	return false
}

// statSeat is the seat whose record this computer keeps (none on a shared computer).
func (g *game) statSeat() int {
	if g.mode == ModeHotseat {
		return -1
	}
	return 0
}

func (g *game) makeTrump(i int, s eu.Suit, lone, pickup bool) {
	g.trump, g.maker, g.alone = s, i, lone
	g.setTurn(-1)
	if lone {
		g.sound("alone")
	} else {
		g.sound("trump")
	}
	how := "called it"
	if pickup {
		how = "ordered it up"
		if i == g.dealer {
			how = "picked it up"
		}
	}
	if lone {
		how += " — going alone!"
	}
	ms := 0.0
	g.emit(func(v int) *event {
		return &event{K: "banner", Text: s.Symbol() + " " + s.Name() + "!", Sub: g.Who(i, v) + " " + how, Blue: team(i) == team(v), Ms: ms}
	})
	if lone {
		g.players[eu.PartnerOf(i)].sitOut = true
		g.loners[i]++
		if i == g.statSeat() {
			g.save.Stats.Loners++
		}
	}
	g.sync()
	g.sleep(g.T("banner") * 0.8)
	dp := g.players[g.dealer]
	if pickup && !dp.sitOut {
		up := g.up
		dp.hand = append(dp.hand, up)
		g.sortHand(dp)
		g.sync()
		g.sound("slide")
		g.sleep(g.T("move"))
		out := g.decideCard(g.dealer, dp.hand, "Pick a card to discard", g.T("think"), func() *cardV {
			return g.byCard[eu.WorstFor(cardsOf(dp.hand), g.trump)]
		})
		dp.hand = without(dp.hand, out)
		out.zn = zone{K: zDiscard}
		g.setHand(dp)
		g.sync()
		g.sound("slide")
		g.sleep(g.T("move"))
	} else if pickup {
		g.up.zn = zone{K: zDown}
	}
	// tidy the kitty off to the dealer's side
	n := 0
	for _, c := range g.deck {
		if c.zn.K != zHand {
			c.zn = zone{K: zTidy, N: n}
			n++
		}
	}
	for _, p := range g.players {
		g.sortHand(p)
	}
	g.sync()
	g.sleep(g.T("move"))
}

func without(h []*cardV, c *cardV) []*cardV {
	out := make([]*cardV, 0, len(h))
	for _, x := range h {
		if x != c {
			out = append(out, x)
		}
	}
	return out
}

/* ---------------- tricks ---------------- */

func (g *game) playTricks() {
	leader := (g.dealer + 1) % 4
	if g.players[leader].sitOut {
		leader = (leader + 1) % 4
	}
	for t := 0; t < 5; t++ {
		g.trick, g.led = nil, eu.NoSuit
		for j := 0; j < 4; j++ {
			i := (leader + j) % 4
			p := g.players[i]
			if p.sitOut {
				continue
			}
			g.setTurn(i)
			g.sync()
			L := g.legal(p)
			text := "Your lead"
			if len(g.trick) > 0 {
				if len(L) < len(p.hand) {
					text = "Follow suit: " + g.led.Name()
				} else {
					text = "Your play — can't follow " + g.led.Name()
				}
			}
			c := g.decideCard(i, L, text, g.T("think")*(0.7+g.rng.Float64()*0.5), func() *cardV { return g.aiPlay(p) })
			ok := false
			for _, x := range g.legal(p) {
				ok = ok || x == c
			}
			if !ok {
				panic("illegal play " + c.id)
			}
			p.hand = without(p.hand, c)
			g.trick = append(g.trick, play{i, c})
			g.played[c.c] = true
			if g.led == eu.NoSuit {
				g.led = g.eff(c)
			}
			c.zn = zone{K: zPlay, P: i, N: len(g.trick), J: (g.rng.Float64() - .5) * 8}
			g.setHand(p)
			g.sync()
			g.sound("play")
			g.sleep(g.T("play"))
		}
		g.setTurn(-1)
		wp, wc := g.winning()
		leader = wp
		g.tricks[team(wp)]++
		wc.win = true
		g.sync()
		g.sound("trick")
		g.emitAll(event{K: "spark", P: wp})
		if g.rng.Float64() < 0.3 {
			g.say(g.players[wp], "trick", 1, eu.NoSuit, 0)
		} else if pw := g.players[eu.PartnerOf(wp)]; g.rng.Float64() < 0.2 {
			g.say(pw, "partner", 1, eu.NoSuit, 0)
		}
		g.sleep(g.T("trick"))
		m := g.tricks[team(wp)] - 1
		for n, pl := range g.trick {
			pl.card.win = false
			pl.card.zn = zone{K: zWon, P: wp, M: m, N: n}
		}
		g.sync()
		g.sound("sweep")
		g.sleep(g.T("move"))
	}
	g.scoreHand()
}

func (g *game) scoreHand() {
	mt := team(g.maker)
	made := g.tricks[mt]
	who, pts := eu.Score(mt, made, g.alone)
	big := false
	me := g.statSeat()
	st := &g.save.Stats
	var march bool
	if made >= 3 {
		if made == 5 {
			big, march = true, true
			g.teamTally[mt].Marches++
			if me >= 0 && mt == team(me) {
				st.Marches++
			}
			g.sound("march")
		} else {
			g.sound("point")
		}
	} else {
		big = true
		g.teamTally[who].Euchres++
		if me >= 0 {
			if who == team(me) {
				st.Euchres++
			} else {
				st.Euchred++
			}
		}
		g.sound("euchred")
		var def, mk []*player
		for _, p := range g.players {
			if p.kind != KindAI {
				continue
			}
			if team(p.i) == who {
				def = append(def, p)
			} else {
				mk = append(mk, p)
			}
		}
		if len(def) > 0 {
			g.say(pickS(g, def), "euchre", 1, eu.NoSuit, 0)
		}
		if len(mk) > 0 {
			g.say(pickS(g, mk), "euchred", 1, eu.NoSuit, 700)
		}
	}
	g.score[who] += pts
	g.teamTally[who].Hands++
	if me >= 0 && who == team(me) {
		st.Hands++
	}
	alone := g.alone
	ms := g.T("banner") * 1.4
	if testFast {
		ms = 0
	}
	g.emit(func(v int) *event {
		var msg string
		switch {
		case !march && made >= 3 && mt == team(v):
			msg = "We made it"
		case !march && made >= 3:
			msg = "They made it"
		case march && alone:
			msg = "Lone March!"
		case march:
			msg = "March!"
		default:
			msg = "Euchred!"
		}
		side, plural := "Them", ""
		if who == team(v) {
			side = "Us"
		}
		if pts > 1 {
			plural = "s"
		}
		return &event{K: "banner", Text: msg, Sub: fmt.Sprintf("%s +%d point%s", side, pts, plural), Blue: who == team(v), Ms: ms}
	})
	n := 24
	if big {
		n = 60
	}
	g.emit(func(v int) *event {
		if who != team(v) && g.mode != ModeHotseat {
			return nil
		}
		return &event{K: "pop", N: n}
	})
	g.sync()
	g.persist()
	g.sleep(g.T("banner") * 1.5)
}

// resultFor is the end-of-game card for seat v.
func (g *game) resultFor(v int) resultT {
	us, them := team(v), 1-team(v)
	var r resultT
	r.won = g.score[us] > g.score[them]
	r.us, r.them, r.l1, r.l2 = g.score[us], g.score[them], "Us", "Them"
	pn := func(i int) string { return g.players[i].name }
	if g.mode == ModeHotseat {
		w := 0
		if g.score[1] > g.score[0] {
			w = 1
		}
		r.kick, r.title = "Winner winner, hotdish dinner", "Game Over!"
		r.sub = pn(w) + " and " + pn(w+2) + " take the game."
		r.us, r.them, r.l1, r.l2 = g.score[0], g.score[1], pn(0)+" & "+pn(2), pn(1)+" & "+pn(3)
		r.won = true
		return r
	}
	if r.won {
		r.kick, r.title, r.sub = "Winner winner, hotdish dinner", "You Won!", "You and "+pn(eu.PartnerOf(v))+" take the game."
	} else {
		r.kick, r.title, r.sub = "Better luck next time", "They Got Ya!", pn((v+1)%4)+" and "+pn((v+3)%4)+" take this one."
	}
	return r
}

func (g *game) endGame() {
	g.finished = true
	g.setTurn(-1)
	g.emitAll(event{K: "prompt"})
	me := g.statSeat()
	if me >= 0 {
		g.recordGame(g.score[team(me)] > g.score[1-team(me)])
	}
	g.emit(func(v int) *event {
		if g.score[team(v)] > g.score[1-team(v)] || g.mode == ModeHotseat {
			return &event{K: "snd", Text: "win"}
		}
		return &event{K: "snd", Text: "lose"}
	})
	g.emit(func(v int) *event {
		if g.score[team(v)] > g.score[1-team(v)] || g.mode == ModeHotseat {
			return &event{K: "confetti", N: 160}
		}
		return nil
	})
	g.emit(func(v int) *event {
		if g.score[team(v)] > g.score[1-team(v)] || g.mode == ModeHotseat {
			return &event{K: "pop", N: 80, Text: "low"}
		}
		return nil
	})
	wt := 0
	if g.score[1] > g.score[0] {
		wt = 1
	}
	var wAI, lAI []*player
	for _, p := range g.players {
		if p.kind == KindAI {
			if team(p.i) == wt {
				wAI = append(wAI, p)
			} else {
				lAI = append(lAI, p)
			}
		}
	}
	if len(wAI) > 0 {
		g.say(pickS(g, wAI), "win", 1, eu.NoSuit, 0)
	}
	if len(lAI) > 0 {
		g.say(pickS(g, lAI), "lose", 1, eu.NoSuit, 300)
	}
	ms := 1400.0
	if testFast {
		ms = 140
	}
	g.sleep(ms)
	g.result = g.resultFor(g.viewer)
	g.result.rec = g.recordText()
	g.showResult = true
	g.resultAt = time.Now()
	if g.server != nil {
		g.server.sendResults(g)
	}
}

func (g *game) recordGame(won bool) {
	st := &g.save.Stats
	st.Played++
	if won {
		st.Won++
		st.Streak++
		st.Best = max(st.Best, st.Streak)
	} else {
		st.Lost++
		st.Streak = 0
	}
	g.persist()
}

func (g *game) recordText() string {
	s := g.save.Stats
	if s.Played == 0 {
		return "No games played yet."
	}
	return fmt.Sprintf("Games: %d · Won: %d · Lost: %d · Euchres: %d · Marches: %d · Best streak: %d", s.Played, s.Won, s.Lost, s.Euchres, s.Marches, s.Best)
}

// handsSorted rebuilds each player's hand from the card zones (guests).
func (g *game) handsFromZones() {
	for _, p := range g.players {
		p.hand = p.hand[:0]
	}
	for _, c := range g.deck {
		if c.zn.K == zHand && c.zn.P >= 0 && c.zn.P < 4 {
			g.players[c.zn.P].hand = append(g.players[c.zn.P].hand, c)
		}
	}
	for _, p := range g.players {
		sort.Slice(p.hand, func(a, b int) bool { return p.hand[a].zn.N < p.hand[b].zn.N })
	}
}
