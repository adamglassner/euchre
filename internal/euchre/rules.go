// Package euchre holds the rules of Euchre and the computer players.
// It has no graphics or sound, so it can be tested on its own.
package euchre

import "sort"

// Suit is one of 'S', 'H', 'D', 'C'.
type Suit byte

const (
	Spades   Suit = 'S'
	Hearts   Suit = 'H'
	Diamonds Suit = 'D'
	Clubs    Suit = 'C'
	NoSuit   Suit = 0
)

var Suits = []Suit{Spades, Hearts, Diamonds, Clubs}

func (s Suit) Name() string {
	switch s {
	case Spades:
		return "Spades"
	case Hearts:
		return "Hearts"
	case Diamonds:
		return "Diamonds"
	case Clubs:
		return "Clubs"
	}
	return ""
}

func (s Suit) Symbol() string {
	switch s {
	case Spades:
		return "♠"
	case Hearts:
		return "♥"
	case Diamonds:
		return "♦"
	case Clubs:
		return "♣"
	}
	return ""
}

func (s Suit) Red() bool { return s == Hearts || s == Diamonds }

// Sister is the other suit of the same colour (home of the left bower).
func (s Suit) Sister() Suit {
	switch s {
	case Spades:
		return Clubs
	case Clubs:
		return Spades
	case Hearts:
		return Diamonds
	case Diamonds:
		return Hearts
	}
	return NoSuit
}

// Card ranks run 9..14 (J=11, Q=12, K=13, A=14).
type Card struct {
	S Suit
	R int
}

func (c Card) ID() string { return string(c.S) + itoa(c.R) }

func (c Card) Label() string {
	return map[int]string{9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A"}[c.R] + c.S.Symbol()
}

func itoa(n int) string {
	if n >= 10 {
		return string(rune('0'+n/10)) + string(rune('0'+n%10))
	}
	return string(rune('0' + n))
}

// Deck returns the 24 cards, 9 through Ace of each suit.
func Deck() []Card {
	d := make([]Card, 0, 24)
	for _, s := range Suits {
		for r := 9; r <= 14; r++ {
			d = append(d, Card{s, r})
		}
	}
	return d
}

// EffSuit is the suit a card plays as when t is trump (the left bower is trump).
func EffSuit(c Card, t Suit) Suit {
	if t != NoSuit && c.R == 11 && c.S == t.Sister() {
		return t
	}
	return c.S
}

// Power ranks a card within a trick.
func Power(c Card, trump, led Suit) int {
	e := EffSuit(c, trump)
	if trump != NoSuit && e == trump {
		if c.R == 11 && c.S == trump {
			return 200
		}
		if c.R == 11 {
			return 199
		}
		return 100 + c.R
	}
	if e == led {
		return c.R
	}
	return 0
}

// Play is one card in a trick.
type Play struct {
	P    int
	Card Card
}

// Legal returns the cards a player may play.
func Legal(hand []Card, trick []Play, trump, led Suit) []Card {
	if len(trick) == 0 {
		return append([]Card(nil), hand...)
	}
	var f []Card
	for _, c := range hand {
		if EffSuit(c, trump) == led {
			f = append(f, c)
		}
	}
	if len(f) > 0 {
		return f
	}
	return append([]Card(nil), hand...)
}

// Winning returns the play currently taking the trick and its power.
func Winning(trick []Play, trump, led Suit) (Play, int) {
	best, bp := Play{P: -1}, -1
	for _, t := range trick {
		if pw := Power(t.Card, trump, led); pw > bp {
			best, bp = t, pw
		}
	}
	return best, bp
}

// Team: 0 = you & Barb (seats 0, 2), 1 = Dale & June (seats 1, 3).
func Team(i int) int      { return i % 2 }
func PartnerOf(i int) int { return (i + 2) % 4 }

// SortHand orders a hand for display: trump first, colours alternating.
func SortHand(h []Card, trump Suit) {
	var order []Suit
	if trump != NoSuit {
		rest := []Suit{Hearts, Clubs, Diamonds, Spades}
		if trump.Red() {
			rest = []Suit{Spades, Diamonds, Clubs, Hearts}
		}
		order = append(order, trump)
		for _, s := range rest {
			if s != trump {
				order = append(order, s)
			}
		}
	} else {
		order = []Suit{Spades, Hearts, Clubs, Diamonds}
	}
	idx := func(s Suit) int {
		for i, x := range order {
			if x == s {
				return i
			}
		}
		return 9
	}
	sort.SliceStable(h, func(a, b int) bool {
		ea, eb := EffSuit(h[a], trump), EffSuit(h[b], trump)
		if idx(ea) != idx(eb) {
			return idx(ea) < idx(eb)
		}
		pa, pb := Power(h[a], trump, ea), Power(h[b], trump, eb)
		if pa != pb {
			return pa > pb
		}
		return h[a].R > h[b].R
	})
}

// Score returns the team that scores and the points for a finished hand.
func Score(makerTeam, makerTricks int, alone bool) (team, pts int) {
	if makerTricks >= 3 {
		if makerTricks == 5 {
			if alone {
				return makerTeam, 4
			}
			return makerTeam, 2
		}
		return makerTeam, 1
	}
	return 1 - makerTeam, 2
}
