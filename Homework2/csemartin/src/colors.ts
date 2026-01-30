import * as d3 from "d3";

export const GENRES = [
	"pop",
	"rap",
	"edm",
	"country",
	"soft pop",
	"soundtrack",
	"art pop",
	"dark r&b",
	"Other"
];

export const GENRE_COLORS: Record<string, string> = {
	"pop": "#1f77b4",        // blue
	"rap": "#ff7f0e",        // orange
	"edm": "#2ca02c",        // green
	"country": "#9467bd",    // purple (distinct from pop blue)
	"soft pop": "#17becf",   // cyan (lighter, but different hue)
	"soundtrack": "#bcbd22", // olive/yellow-green
	"art pop": "#e377c2",    // pink/magenta
	"dark r&b": "#d62728",   // red (kept strong)
	"Other": "#7f7f7f"       // neutral gray
};

export const genreColorScale = d3
	.scaleOrdinal<string, string>()
	.domain(GENRES)
	.range(GENRES.map(g => GENRE_COLORS[g]));