// The folks who might pull up a chair. Each face has a gender, and the
// titles and names it gets always fit it. Their table talk goes with the face.
package main

import "math/rand"

type folkFace struct {
	id     string
	female bool
	titles []string
	names  []string
	lines  map[string][]string // order, pass, call, alone, trick, euchre, euchred, partner, win, lose
}

// {s}/{S}: the suit (lower/upper case); {p}: their partner's name.
var cast = []*folkFace{
	{id: "barb", female: true, titles: []string{"Aunt"}, names: []string{"Barb", "Linda", "Deb", "Carol", "Sue", "Patty", "Cindy"},
		lines: map[string][]string{
			"order": {"Pick it up!", "I'll order that up, hon.", "Gimme that one."}, "pass": {"Pass.", "Not for me.", "Nope, pass."},
			"call": {"Make it {s}!", "Let's go {s}.", "{S}, please!"}, "alone": {"I'm goin' alone!", "Sit back, hon. I got this."},
			"trick": {"Got it!", "Mine!", "Thank you very much."}, "euchre": {"Euchred! Ha!", "Gotcha!"}, "euchred": {"Well, shoot.", "Ope.", "Oh, for Pete's sake."},
			"partner": {"Nice one, {p}!", "Atta way!", "That's my partner!"}, "win": {"We did it, hon!"}, "lose": {"Oh well. Coffee?"}}},
	{id: "dale", titles: []string{"Uncle"}, names: []string{"Dale", "Gary", "Duane", "Rick", "Dennis", "Randy", "Butch"},
		lines: map[string][]string{
			"order": {"Pick 'er up.", "You betcha, pick it up.", "I'll take that."}, "pass": {"Pass.", "Uff da. Pass.", "Nah."},
			"call": {"{S}. Yep.", "Make it {s}.", "Gonna go {s}."}, "alone": {"Goin' alone, by golly!", "Hold my coffee."},
			"trick": {"Yep.", "There she goes.", "Ope, that's mine."}, "euchre": {"Euchred ya!", "Ha! Get outta here!"}, "euchred": {"Dang it.", "Well, that's a stinker.", "Ope."},
			"partner": {"Nice, {p}."}, "win": {"Good game, good game."}, "lose": {"Ah, ya got us."}}},
	{id: "june", female: true, titles: []string{"Grandma"}, names: []string{"June", "Dot", "Bev", "Lois", "Arlene", "Dolores", "Fern"},
		lines: map[string][]string{
			"order": {"Order it up, dear.", "I'll take it!", "Pick it up, sweetie."}, "pass": {"Pass, dear.", "I pass.", "Not this time."},
			"call": {"{S}, I think.", "Let's try {s}.", "{S}!"}, "alone": {"I'll go it alone, dear.", "Grandma's going alone."},
			"trick": {"Oh, that one's mine!", "Oh, for cute!", "Well, isn't that something."}, "euchre": {"Oh, you got euchred, dear!", "Euchred! Tee hee."}, "euchred": {"Oh, fiddlesticks.", "Oh, my."},
			"partner": {"Good job, {p}!"}, "win": {"Oh, what fun!"}, "lose": {"Well, good game, kids."}}},
	{id: "kayla", female: true, titles: []string{"Cousin"}, names: []string{"Kayla", "Amber", "Jen", "Missy", "Tara", "Becky", "Brooke"},
		lines: map[string][]string{
			"order": {"Pick it up!", "Order it up, for sure.", "Yup, pick it up."}, "pass": {"Pass.", "Nope.", "I'm good, pass."},
			"call": {"{S}, for sure!", "Let's do {s}.", "{S}. Easy."}, "alone": {"Goin' alone, watch this!", "Solo! Don't help me."},
			"trick": {"Mine!", "Yesss.", "Called it."}, "euchre": {"Euchred! Sorry, not sorry.", "Ha! Euchred!"}, "euchred": {"Ugh, seriously?", "Ope. My bad."},
			"partner": {"Nice, {p}!", "Teamwork!"}, "win": {"We won! Rematch anyway?"}, "lose": {"Okay, rematch. Now."}}},
	{id: "gloria", female: true, titles: []string{"Neighbor"}, names: []string{"Gloria", "Shirley", "Joan", "Darlene", "Judy", "Marlys", "Elaine"},
		lines: map[string][]string{
			"order": {"I'll have that one, hon.", "Order it up.", "Pick it up, dear."}, "pass": {"Pass, hon.", "Not for me.", "I'll pass."},
			"call": {"Let's go {s}.", "{S}, please.", "Make it {s}, hon."}, "alone": {"I'll take this one alone.", "Stand back, I've got it."},
			"trick": {"That's mine, thank you.", "Well, look at that.", "Don't mind if I do."}, "euchre": {"Euchred! Bless your heart.", "Oh, you got euchred!"}, "euchred": {"Oh, for crying out loud.", "Well, shoot."},
			"partner": {"Good one, {p}!", "That's the way, {p}."}, "win": {"Lemon bars for the winners!"}, "lose": {"Good game. More coffee?"}}},
	{id: "opal", female: true, titles: []string{"Granny"}, names: []string{"Opal", "Hazel", "Mae", "Ruth", "Ida", "Bea", "Edna"},
		lines: map[string][]string{
			"order": {"Pick it up, sugar.", "Order it up.", "I'll take it."}, "pass": {"Pass, sugar.", "Pass.", "Not this time, dear."},
			"call": {"{S}, I believe.", "How about {s}.", "{S}, dear."}, "alone": {"Granny's going alone.", "I'll play this one by myself."},
			"trick": {"Oh my, that's mine.", "Well, I'll be.", "Isn't that nice."}, "euchre": {"You've been euchred, dear.", "Euchred! Oh, that's fun."}, "euchred": {"Oh, goodness.", "Oh, my stars."},
			"partner": {"Well done, {p}.", "That's my partner."}, "win": {"What a lovely game!"}, "lose": {"Good game, everyone."}}},
	{id: "walt", titles: []string{"Grandpa"}, names: []string{"Walt", "Earl", "Vern", "Harold", "Lyle", "Merle", "Arnie"},
		lines: map[string][]string{
			"order": {"Pick 'er up.", "Order it up, I says.", "Yep, pick it up."}, "pass": {"Pass.", "Nope.", "Not a chance. Pass."},
			"call": {"{S}.", "Make it {s}.", "{S}. Final answer."}, "alone": {"Goin' alone. Hold my hat.", "Sit this one out, partner."},
			"trick": {"Yep.", "Mine, by golly.", "Still got it."}, "euchre": {"Euchred! Heh heh.", "Got ya!"}, "euchred": {"Aw, nuts.", "Well, I'll be darned."},
			"partner": {"Atta way, {p}.", "Good one, {p}."}, "win": {"Back in my day, we won too."}, "lose": {"Ah, nuts. Good game."}}},
	{id: "tyler", titles: []string{"Cousin"}, names: []string{"Tyler", "Cody", "Kyle", "Brandon", "Travis", "Josh", "Dustin"},
		lines: map[string][]string{
			"order": {"Pick it up, dude.", "Order it up!", "Yeah, pick it up."}, "pass": {"Pass.", "Nah, pass.", "Pass, I guess."},
			"call": {"{S}, let's go!", "Going {s}.", "{S}. Trust me."}, "alone": {"Going alone, baby!", "Solo time."},
			"trick": {"Let's go!", "Boom.", "Easy money."}, "euchre": {"Euchred! Let's gooo!", "Ha! Euchred!"}, "euchred": {"Aw, man.", "Dang it."},
			"partner": {"Nice one, {p}!", "Good call, {p}!"}, "win": {"GG! We won!"}, "lose": {"GG. Rematch?"}}},
	{id: "lars", titles: []string{"Neighbor"}, names: []string{"Lars", "Arvid", "Gunnar", "Sven", "Nels", "Ole", "Erik"},
		lines: map[string][]string{
			"order": {"Ya, pick it up.", "Order it up, then.", "Pick 'er up, ya."}, "pass": {"Pass, ya.", "Uff da. Pass.", "Nope, pass."},
			"call": {"Ya, {s}.", "{S}, then.", "Let's go {s}, ya."}, "alone": {"Goin' alone, you betcha.", "I got this one, ya."},
			"trick": {"Ya, that's mine.", "Oh, ya.", "There ya go."}, "euchre": {"Euchred, ya! Ha!", "Oh, ya got euchred."}, "euchred": {"Uff da.", "Oh, for cryin' out loud."},
			"partner": {"Good one, {p}, ya.", "Nice, {p}."}, "win": {"Ya, that's a win, then."}, "lose": {"Ah, ya got us. Good game."}}},
	{id: "coach", titles: []string{"Coach"}, names: []string{"Bob", "Jim", "Mike", "Ron", "Tom", "Bill", "Don"},
		lines: map[string][]string{
			"order": {"Pick it up!", "Order it up, let's go.", "That's a pick-up."}, "pass": {"Pass.", "Pass, regroup.", "Not this play. Pass."},
			"call": {"{S}! Let's run it.", "Calling {s}.", "{S}. Execute."}, "alone": {"Goin' alone. Bench my partner.", "One-man offense!"},
			"trick": {"That's how it's done.", "Touchdown!", "Good hustle."}, "euchre": {"Euchred! Defense wins!", "Interception!"}, "euchred": {"Tough break.", "Shake it off."},
			"partner": {"Great hustle, {p}!", "Nice work, {p}!"}, "win": {"That's a win, team!"}, "lose": {"Good game. We'll get 'em next time."}}},
}

var faceByID = map[string]*folkFace{}

func init() {
	for _, f := range cast {
		faceByID[f.id] = f
	}
}

func faceIDs() []string {
	out := make([]string, len(cast))
	for i, f := range cast {
		out[i] = f.id
	}
	return out
}

// folk is one computer player picked for a game.
type folk struct{ face, name, full string }

// randomFolks picks n different faces (not in avoid) and gives each a name
// that fits it, never repeating a name already at the table.
func randomFolks(rng *rand.Rand, n int, avoidFaces, avoidNames map[string]bool) []folk {
	var pool []*folkFace
	for _, f := range cast {
		if !avoidFaces[f.id] {
			pool = append(pool, f)
		}
	}
	rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	var out []folk
	for _, f := range pool {
		if len(out) == n {
			break
		}
		var names []string
		for _, nm := range f.names {
			if !avoidNames[nm] {
				names = append(names, nm)
			}
		}
		if len(names) == 0 {
			continue
		}
		name := names[rng.Intn(len(names))]
		avoidNames[name] = true
		out = append(out, folk{face: f.id, name: name, full: f.titles[rng.Intn(len(f.titles))] + " " + name})
	}
	return out
}
