package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Same shape as the 1.0 save file (plus the Play Together choices), so
// records carry over.
type saveData struct {
	Settings struct {
		Music  bool   `json:"music"`
		Sfx    bool   `json:"sfx"`
		Vol    int    `json:"vol"`
		Target int    `json:"target"`
		Stick  int    `json:"stick"`
		Speed  string `json:"speed"`
		// Play Together (2.0)
		Name       string   `json:"name,omitempty"`
		Face       string   `json:"face,omitempty"`
		Host       string   `json:"host,omitempty"`
		HotN       int      `json:"hotN,omitempty"`
		HotPartner int      `json:"hotPartner,omitempty"`
		HotNames   []string `json:"hotNames,omitempty"`
		HotFaces   []string `json:"hotFaces,omitempty"`
	} `json:"settings"`
	Stats struct {
		Played  int `json:"played"`
		Won     int `json:"won"`
		Lost    int `json:"lost"`
		Hands   int `json:"hands"`
		Euchres int `json:"euchres"`
		Euchred int `json:"euchred"`
		Marches int `json:"marches"`
		Loners  int `json:"loners"`
		Streak  int `json:"streak"`
		Best    int `json:"best"`
	} `json:"stats"`
}

func defaultSave() saveData {
	var s saveData
	s.Settings.Music, s.Settings.Sfx, s.Settings.Vol = true, true, 60
	s.Settings.Target, s.Settings.Stick, s.Settings.Speed = 10, 1, "normal"
	return s
}

// dataDir is %APPDATA%\Ironite\Euchre on Windows.
func dataDir() string {
	d, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(d, "Ironite", productName)
}

func loadSave() saveData {
	s := defaultSave()
	if dir := dataDir(); dir != "" {
		if b, err := os.ReadFile(filepath.Join(dir, "save.json")); err == nil {
			_ = json.Unmarshal(b, &s)
		}
	}
	if s.Settings.Target != 5 && s.Settings.Target != 10 {
		s.Settings.Target = 10
	}
	if _, ok := paceOf[s.Settings.Speed]; !ok {
		s.Settings.Speed = "normal"
	}
	s.Settings.Vol = min(100, max(0, s.Settings.Vol))
	return s
}

func (g *game) persist() {
	dir := dataDir()
	if dir == "" {
		return
	}
	b, err := json.MarshalIndent(g.save, "", "  ")
	if err != nil {
		return
	}
	_ = os.MkdirAll(dir, 0o755)
	path := filepath.Join(dir, "save.json")
	if os.WriteFile(path+".tmp", b, 0o644) == nil {
		_ = os.Rename(path+".tmp", path)
	}
}
