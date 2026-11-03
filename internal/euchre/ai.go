package euchre

import "sort"

func trumpValue(c Card, t Suit) float64 {
	if c.R == 11 && c.S == t {
		return 3.2
	}
	if c.R == 11 && c.S == t.Sister() {
		return 2.7
	}
	if c.S != t {
		return 0
	}
	return map[int]float64{14: 2.0, 13: 1.6, 12: 1.3, 10: 1.1, 9: 1.0}[c.R]
}

type strengthT struct {
	v           float64
	nt          int
	right, left bool
}

func strength(hand []Card, t Suit) strengthT {
	var st strengthT
	off := map[Suit]int{}
	for _, c := range hand {
		if tv := trumpValue(c, t); tv > 0 {
			st.v += tv
			st.nt++
		} else {
			off[c.S]++
			if c.R == 14 {
				st.v += 0.9
			} else if c.R == 13 {
				st.v += 0.25
			}
		}
		if c.R == 11 && c.S == t {
			st.right = true
		}
		if c.R == 11 && c.S == t.Sister() {
			st.left = true
		}
	}
	for _, s := range Suits {
		if s != t && off[s] == 0 && st.nt >= 2 {
			st.v += 0.45
		}
	}
	return st
}

// WorstFor is the card a dealer would throw away with t as trump.
func WorstFor(hand []Card, t Suit) Card {
	var non []Card
	for _, c := range hand {
		if EffSuit(c, t) != t {
			non = append(non, c)
		}
	}
	if len(non) > 0 {
		count := func(s Suit) int {
			n := 0
			for _, c := range non {
				if c.S == s {
					n++
				}
			}
			return n
		}
		b2i := func(b bool) int {
			if b {
				return 1
			}
			return 0
		}
		sort.SliceStable(non, func(i, j int) bool {
			a, b := non[i], non[j]
			if x, y := b2i(a.R == 14), b2i(b.R == 14); x != y {
				return x < y
			}
			if x, y := count(a.S), count(b.S); x != y {
				return x < y
			}
			return a.R < b.R
		})
		return non[0]
	}
	h := append([]Card(nil), hand...)
	sort.SliceStable(h, func(i, j int) bool { return trumpValue(h[i], t) < trumpValue(h[j], t) })
	return h[0]
}

func without(h []Card, c Card) []Card {
	out := make([]Card, 0, len(h))
	for _, x := range h {
		if x != c {
			out = append(out, x)
		}
	}
	return out
}

// Bid1 decides whether seat i orders up (or picks up) the turned card.
func Bid1(hand []Card, i, dealer int, up Card) (call, alone bool) {
	var st strengthT
	if i == dealer {
		h := append(append([]Card(nil), hand...), up)
		h = without(h, WorstFor(h, up.S))
		st = strength(h, up.S)
	} else {
		st = strength(hand, up.S)
		uv := trumpValue(up, up.S)
		if Team(i) == Team(dealer) {
			st.v += uv * 0.55
		} else {
			st.v -= uv * 0.55
		}
	}
	call = st.v >= 6.1
	return call, call && st.v >= 9.6 && st.right && st.nt >= 3
}

// Bid2 picks a suit to name in round two (NoSuit to pass).
func Bid2(hand []Card, turned Suit, stuck bool) (Suit, bool) {
	best, bv := NoSuit, strengthT{v: -1}
	for _, s := range Suits {
		if s == turned {
			continue
		}
		if st := strength(hand, s); best == NoSuit || st.v > bv.v {
			best, bv = s, st
		}
	}
	if bv.v >= 5.8 || stuck {
		return best, bv.v >= 9.4 && bv.right && bv.nt >= 3
	}
	return NoSuit, false
}

// PlayState is what a computer player sees when it's their turn.
type PlayState struct {
	Seat, Maker int
	Hand        []Card
	Trick       []Play
	Trump, Led  Suit
	Played      map[Card]bool
}

func (ps PlayState) highestTrumpLeft() bool {
	t := ps.Trump
	order := []Card{{t, 11}, {t.Sister(), 11}, {t, 14}, {t, 13}, {t, 12}, {t, 10}, {t, 9}}
	for _, c := range order {
		if ps.Played[c] {
			continue
		}
		for _, h := range ps.Hand {
			if h == c {
				return true
			}
		}
		return false
	}
	return false
}

// ChoosePlay picks the card a computer player plays.
func ChoosePlay(ps PlayState) Card {
	L := Legal(ps.Hand, ps.Trick, ps.Trump, ps.Led)
	isTrump := func(c Card) bool { return EffSuit(c, ps.Trump) == ps.Trump }
	pow := func(c Card) int { return Power(c, ps.Trump, ps.Led) }
	lowKey := func(c Card) int {
		if isTrump(c) {
			return 1000 + pow(c)
		}
		if c.R == 14 {
			return 50
		}
		return c.R
	}
	lowest := func() Card {
		s := append([]Card(nil), L...)
		sort.SliceStable(s, func(i, j int) bool { return lowKey(s[i]) < lowKey(s[j]) })
		return s[0]
	}
	if len(ps.Trick) == 0 { // leading
		var tr, off []Card
		for _, c := range L {
			if isTrump(c) {
				tr = append(tr, c)
			} else {
				off = append(off, c)
			}
		}
		sort.SliceStable(tr, func(i, j int) bool { return Power(tr[i], ps.Trump, NoSuit) > Power(tr[j], ps.Trump, NoSuit) })
		if Team(ps.Maker) == Team(ps.Seat) && len(tr) > 0 {
			if ps.highestTrumpLeft() && (len(tr) >= 2 || ps.Seat == ps.Maker) {
				return tr[0]
			}
			if ps.Seat != ps.Maker && ps.Maker == PartnerOf(ps.Seat) {
				return tr[0] // lead trump to the partner who called it
			}
		}
		for _, c := range off {
			if c.R == 14 {
				return c
			}
		}
		sort.SliceStable(off, func(i, j int) bool { return off[i].R < off[j].R })
		if len(off) > 0 {
			return off[0]
		}
		return tr[len(tr)-1]
	}
	best, bp := Winning(ps.Trick, ps.Trump, ps.Led)
	if Team(best.P) == Team(ps.Seat) {
		return lowest()
	}
	var beats []Card
	for _, c := range L {
		if pow(c) > bp {
			beats = append(beats, c)
		}
	}
	if len(beats) > 0 {
		sort.SliceStable(beats, func(i, j int) bool { return pow(beats[i]) < pow(beats[j]) })
		return beats[0]
	}
	return lowest()
}
