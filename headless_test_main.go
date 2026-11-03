//go:build headless

// A test build with no window or sound: plays whole games with the computer
// at every seat, including online games between a host and guests over
// real TCP on this computer. Run: go run -tags headless .
package main

import (
	"fmt"
	"os"
	"time"
)

type uiState struct{}

func check(ok bool, f string, a ...any) {
	if !ok {
		fmt.Printf("FAIL: "+f+"\n", a...)
		os.Exit(1)
	}
}

func waitFor(what string, d time.Duration, f func() bool) {
	end := time.Now().Add(d)
	for time.Now().Before(end) {
		if f() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	check(false, "timed out waiting for %s", what)
}

func locked[T any](g *game, f func() T) T {
	g.mu.Lock()
	defer g.mu.Unlock()
	return f()
}

func main() {
	autopilot, testFast = true, true

	// 1. single player: three random folks with names that fit
	g := newGameState()
	g.mu.Lock()
	g.goPlay()
	seen := map[string]bool{}
	for i := 1; i < 4; i++ {
		p := g.players[i]
		f := faceByID[p.face]
		check(f != nil && p.kind == KindAI, "seat %d should be a computer folk", i)
		ok := false
		for _, n := range f.names {
			ok = ok || n == p.name
		}
		check(ok, "%s doesn't fit face %s", p.name, p.face)
		check(!seen[p.face] && !seen[p.name], "repeated face or name")
		seen[p.face], seen[p.name] = true, true
		fmt.Printf("solo seat %d: %s (%s)\n", i, p.full, p.face)
	}
	g.mu.Unlock()
	waitFor("solo game", 3*time.Minute, func() bool { return locked(g, func() bool { return g.showResult }) })
	fmt.Printf("solo: %d-%d %q\n", g.score[0], g.score[1], g.result.title)

	// 2. online: a host and two guests
	host := newGameState()
	host.setup.name, host.setup.face = "Hosty", "coach"
	host.mu.Lock()
	host.hostGame()
	check(host.server != nil, "host should be listening")
	host.mu.Unlock()
	var guests []*game
	for i, nm := range []string{"Ann", "Bo"} {
		c := newGameState()
		c.save.Stats = defaultSave().Stats // everyone here shares one save folder
		c.setup.name, c.setup.face = nm, []string{"kayla", "lars"}[i]
		c.mu.Lock()
		c.joinGame("127.0.0.1")
		c.mu.Unlock()
		guests = append(guests, c)
		waitFor(nm+" to join", 10*time.Second, func() bool {
			return locked(host, func() bool { return len(host.server.peers) == i+1 }) && locked(c, func() bool { return c.mode == ModeClient })
		})
	}
	host.mu.Lock()
	check(host.players[2].name == "Ann" && host.players[1].name == "Bo", "join order: partner first, then left")
	host.switchTeam(2) // Ann becomes an opponent; a computer takes her old seat
	check(host.players[2].kind == KindAI && host.players[3].name == "Ann", "switch team: %v %v", host.players[2].name, host.players[3].name)
	host.mu.Unlock()
	time.Sleep(100 * time.Millisecond)
	for _, c := range guests {
		c.mu.Lock()
		check(len(c.lobby) == 4, "guest should have the lobby")
		c.mu.Unlock()
	}
	check(locked(guests[0], func() int { return guests[0].viewer }) == 3, "Ann should now sit in seat 3")

	for round := 1; round <= 2; round++ {
		host.mu.Lock()
		if round == 1 {
			host.startHosted()
		} else {
			host.newDeal()
		}
		host.mu.Unlock()
		// while it plays, guests should always know their own cards and nobody else's
		done := false
		for !done {
			time.Sleep(15 * time.Millisecond)
			for _, c := range guests {
				c.mu.Lock()
				me := c.viewer
				for _, card := range c.deck {
					if card.zn.K == zHand && card.zn.P == me {
						check(card.id != "", "guest doesn't know a card in their own hand")
					}
				}
				for i, p := range c.players {
					if i != me {
						for _, card := range p.hand {
							check(card.id == "" || card.fa1 == 180, "guest can see someone else's card")
						}
					}
				}
				c.mu.Unlock()
			}
			done = locked(host, func() bool { return host.showResult })
		}
		waitFor("guests' results", 10*time.Second, func() bool {
			for _, c := range guests {
				if !locked(c, func() bool { return c.showResult }) {
					return false
				}
			}
			return true
		})
		hs := host.score
		for _, c := range guests {
			c.mu.Lock()
			v := c.viewer
			check(c.result.us == hs[team(v)] && c.result.them == hs[1-team(v)], "guest result %d-%d vs host %v", c.result.us, c.result.them, hs)
			check(c.save.Stats.Played == round, "guest record: %d games", c.save.Stats.Played)
			fmt.Printf("round %d: %s sees %q %d-%d\n", round, c.players[v].name, c.result.title, c.result.us, c.result.them)
			c.mu.Unlock()
		}
	}

	// 3. a guest leaves mid-game: a computer player takes over and the game finishes
	host.mu.Lock()
	host.newDeal()
	host.mu.Unlock()
	time.Sleep(400 * time.Millisecond)
	bo := guests[1]
	bo.mu.Lock()
	bo.leaveOnline()
	bo.mu.Unlock()
	waitFor("game after a guest left", 3*time.Minute, func() bool { return locked(host, func() bool { return host.showResult }) })
	host.mu.Lock()
	check(host.players[1].kind == KindAI, "Bo's seat should be a computer now")
	check(len(host.server.peers) == 1, "one guest left")
	host.leaveOnline()
	host.mu.Unlock()
	waitFor("Ann to hear the host closed", 10*time.Second, func() bool {
		return locked(guests[0], func() bool { return guests[0].mode == ModeSolo && guests[0].message != "" })
	})

	// 4. same computer: three people, answered through the real pass screen,
	// bid boxes and card picks
	autopilot = false
	hs := newGameState()
	hs.mu.Lock()
	hs.setup.hotN, hs.setup.hotPartner = 3, 2 // Player 3 partners Player 1
	hs.setup.hotNames = [4]string{"Al", "Bea", "Cy", ""}
	hs.startHotseat()
	check(hs.players[0].name == "Al" && hs.players[2].name == "Cy" && hs.players[1].name == "Bea" && hs.players[3].kind == KindAI, "hot-seat seating")
	hs.mu.Unlock()
	passes, turns := 0, map[int]int{}
	for !locked(hs, func() bool { return hs.showResult }) {
		time.Sleep(5 * time.Millisecond)
		hs.mu.Lock()
		switch {
		case hs.passCh != nil:
			for _, c := range hs.deck {
				check(c.zn.K != zHand || c.fa1 == 180, "a hand is showing behind the pass screen")
			}
			passes++
			hs.passCh <- struct{}{}
			hs.passCh = nil
		case hs.ask != nil:
			a := hs.ask
			hs.ask = nil
			check(hs.players[hs.viewer].kind == KindLocal, "asking a computer seat")
			turns[hs.viewer]++
			i := len(a.btns) - 1
			if hs.rng.Intn(4) == 0 {
				i = 0
			}
			a.ch <- askRes{btn: a.btns[i], idx: i}
		case hs.wait != nil:
			w := hs.wait
			hs.wait = nil
			for _, c := range w.all {
				check(c.zn.P == hs.viewer, "picking from someone else's hand")
			}
			turns[hs.viewer]++
			w.ch <- w.ok[hs.rng.Intn(len(w.ok))]
		}
		hs.mu.Unlock()
	}
	check(passes > 3 && turns[0] > 0 && turns[1] > 0 && turns[2] > 0 && turns[3] == 0, "hot-seat turns %v passes %d", turns, passes)
	fmt.Printf("same computer: %d passes, turns %v, %q %s\n", passes, turns, hs.result.title, hs.result.sub)
	fmt.Println("PASS")
}
