import * as d3 from "d3";

// Genre families
export const GENRES = [
	"Pop",
	"Hip-Hop / Rap",
	"Rock / Alternative",
	"Electronic / EDM",
	"R&B / Soul",
	"Latin",
	"Country / Folk",
	"Jazz / Gospel",
	"Soundtrack",
	"Other"
];

export const GENRE_COLORS: Record<string, string> = {
	"Pop": "#1f77b4",                // blue
	"Hip-Hop / Rap": "#ff7f0e",      // orange
	"Electronic / EDM": "#2ca02c",   // green
	"Country / Folk": "#9467bd",     // purple
	"R&B / Soul": "#d62728",         // red
	"Soundtrack": "#bcbd22",         // olive
	"Rock / Alternative": "#8c564b", // brown (distinct)
	"Latin": "#17becf",              // cyan (distinct)
	"Jazz / Gospel": "#e377c2",      // magenta
	"Other": "#7f7f7f"               // gray
};

export const genreColorScale = d3
	.scaleOrdinal<string, string>()
	.domain(GENRES)
	.range(GENRES.map(g => GENRE_COLORS[g]));