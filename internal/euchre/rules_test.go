package euchre

import (
	"math/rand"
	"testing"
)

func TestBowers(t *testing.T) {
	if EffSuit(Card{Diamonds, 11}, Hearts) != Hearts {
		t.Fatal("left bower should be trump")
	}
	if Power(Card{Hearts, 11}, Hearts, Spades) != 200 || Power(Card{Diamonds, 11}, Hearts, Spades) != 199 {
		t.Fatal("bower power")
	}
	if Power(Card{Hearts, 14}, Hearts, Spades) <= Power(Card{Spades, 14}, Hearts, Spades) {
		t.Fatal("trump beats led suit")
	}
	if Power(Card{Clubs, 14}, Hearts, Spades) != 0 {
		t.Fatal("off-suit is worthless")
	}
	// holding only the left bower of the led trump suit: must follow with it
	l := Legal([]Card{{Diamonds, 11}, {Diamonds, 9}}, []Play{{1, Card{Hearts, 9}}}, Hearts, Hearts)
	if len(l) != 1 || l[0] != (Card{Diamonds, 11}) {
		t.Fatalf("legal %v", l)
	}
}

func TestScore(t *testing.T) {
	cases := []struct {
		tricks, team, pts int
		alone             bool
	}{{3, 0, 1, false}, {4, 0, 1, true}, {5, 0, 2, false}, {5, 0, 4, true}, {2, 1, 2, false}, {0, 1, 2, true}}
	for _, c := range cases {
		if tm, p := Score(0, c.tricks, c.alone); tm != c.team || p != c.pts {
			t.Fatalf("%+v got %d %d", c, tm, p)
		}
	}
}

// Plays thousands of all-computer games and checks every card played was legal.
func TestSimulatedGames(t *testing.T) {
	rng := rand.New(rand.NewSource(7))
	hands, misdeals, calls := 0, 0, 0
	for g := 0; g < 400; g++ {
		score := [2]int{}
		dealer := rng.Intn(4)
		for score[0] < 10 && score[1] < 10 {
			hands++
			d := Deck()
			rng.Shuffle(len(d), func(i, j int) { d[i], d[j] = d[j], d[i] })
			var h [4][]Card
			for p := 0; p < 4; p++ {
				h[p] = append([]Card(nil), d[p*5:p*5+5]...)
			}
			up := d[20]
			trump, maker, alone := NoSuit, -1, false
			for j := 1; j <= 4 && trump == NoSuit; j++ {
				i := (dealer + j) % 4
				if c, a := Bid1(h[i], i, dealer, up); c {
					trump, maker, alone = up.S, i, a
					h[dealer] = append(h[dealer], up)
					h[dealer] = without(h[dealer], WorstFor(h[dealer], trump))
				}
			}
			for j := 1; j <= 4 && trump == NoSuit; j++ {
				i := (dealer + j) % 4
				if s, a := Bid2(h[i], up.S, i == dealer); s != NoSuit {
					if s == up.S {
						t.Fatal("named the turned-down suit")
					}
					trump, maker, alone = s, i, a
				}
			}
			if trump == NoSuit {
				misdeals++
				dealer = (dealer + 1) % 4
				continue
			}
			calls++
			for p := 0; p < 4; p++ {
				if len(h[p]) != 5 {
					t.Fatalf("hand size %d", len(h[p]))
				}
			}
			sit := -1
			if alone {
				sit = PartnerOf(maker)
			}
			played := map[Card]bool{}
			tricks := [2]int{}
			leader := (dealer + 1) % 4
			if leader == sit {
				leader = (leader + 1) % 4
			}
			for tr := 0; tr < 5; tr++ {
				var trick []Play
				led := NoSuit
				for j := 0; j < 4; j++ {
					i := (leader + j) % 4
					if i == sit {
						continue
					}
					c := ChoosePlay(PlayState{Seat: i, Maker: maker, Hand: h[i], Trick: trick, Trump: trump, Led: led, Played: played})
					ok := false
					for _, x := range Legal(h[i], trick, trump, led) {
						ok = ok || x == c
					}
					if !ok {
						t.Fatalf("illegal play %v by %d", c, i)
					}
					h[i] = without(h[i], c)
					trick = append(trick, Play{i, c})
					played[c] = true
					if led == NoSuit {
						led = EffSuit(c, trump)
					}
				}
				w, _ := Winning(trick, trump, led)
				tricks[Team(w.P)]++
				leader = w.P
			}
			tm, pts := Score(Team(maker), tricks[Team(maker)], alone)
			score[tm] += pts
			dealer = (dealer + 1) % 4
		}
	}
	t.Logf("%d hands, %d called, %d misdeals", hands, calls, misdeals)
	if misdeals != 0 {
		t.Fatal("stick the dealer should prevent misdeals")
	}
}
