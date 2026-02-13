import { useEffect } from "react";
import * as d3 from "d3";
import { GENRES, genreColorScale } from "../../colors";
import type { Track } from "../Dashboard";

// Linear regression utility (returns slope and intercept)
function linearRegression(
	points: Track[],
	xField: keyof Track,
	yField: keyof Track
) {
	const filtered = points.filter(d =>
		Number.isFinite(Number(d[xField])) &&
		Number.isFinite(Number(d[yField]))
	);

	if (filtered.length < 2) {
		return { slope: 0, intercept: 0 };
	}

	const xs = filtered.map(d => Number(d[xField]));
	const ys = filtered.map(d => Number(d[yField]));

	const meanX = d3.mean(xs)!;
	const meanY = d3.mean(ys)!;

	let num = 0;
	let den = 0;

	for (let i = 0; i < xs.length; i++) {
		num += (xs[i] - meanX) * (ys[i] - meanY);
		den += (xs[i] - meanX) ** 2;
	}

	if (den === 0) {
		return { slope: 0, intercept: meanY };
	}

	const slope = num / den;
	const intercept = meanY - slope * meanX;

	return { slope, intercept };
}

// Utility to format duration from ms to MM:SS (or HH:MM:SS if long enough)
function formatDuration(ms: number): string {
    if (!ms || !Number.isFinite(ms)) return "N/A";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    if (hours > 0) {
        const hh = String(hours).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }

    return `${mm}:${ss}`;
}

// Utility to invert a hex color
function invertColor(hex: string): string {
   return "black";
	/*
	const c = d3.color(hex);
	
    if (!c) return "black";

    const rgb = c.rgb();
    // Perceptual luminance
    const luminance =
        0.299 * rgb.r +
        0.587 * rgb.g +
        0.114 * rgb.b;

    // If bright color --> use black stroke
    // If dark color --> use white stroke
    //return luminance > 140 ? "black" : "white";
	if (luminance > 140) {
		return "black";
	} else {
		return "white";
	}
	*/
}

function formatSizeLabel(field: keyof Track) {
    switch (field) {
        case "artist_followers": return "Followers";
        case "artist_popularity": return "Artist Popularity";
        case "track_popularity": return "Track Popularity";
        case "release_year": return "Release Year";
        default: return "";
    }
}

function formatSizeValue(v: number, field: keyof Track) {
	if (!Number.isFinite(v)) return "N/A";

	if (field === "release_year") return String(Math.round(v));

	if (field === "artist_popularity" || field === "track_popularity")
		return String(Math.round(v));

	return Math.round(v).toLocaleString();
}


export default function ScatterTrend({
	data,
	selectedArtist,
	showArtistPoints,
	showArtistLines,
	xField,
	yField,
	sizeField,
	xLabel,
	yLabel
}: {
	data: Track[];
	selectedArtist: string | null;
	showArtistPoints: boolean;
	showArtistLines: boolean;
	xField: keyof Track;
	yField: keyof Track;
	sizeField: keyof Track;
	xLabel: string;
	yLabel: string;
}) {

	// SCATTER PLOT + TRENDLINES
	useEffect(() => {
		if (!data) return;
		const svg = d3.select("#scatter-svg");

		const draw = () => {
			// To mirror streamgraph's pattern
			const genreVisibility = new Map<string, boolean>();
			GENRES.forEach(g => genreVisibility.set(g, true));

			const autoYScaling = true; // toggle magnitude for UI

			svg.selectAll("*").remove();
			let currentTransform = d3.zoomIdentity;

			const margin = { top: 30, right: 140, bottom: 50, left: 60 };
			const svgNode = svg.node() as SVGSVGElement;

			const width = svgNode.clientWidth - margin.left - margin.right;
			const height = svgNode.clientHeight - margin.top - margin.bottom;

			if (width <= 0 || height <= 0) return;

			const defs = svg.append("defs");

			defs.append("clipPath")
				.attr("id", "scatter-clip")
				.append("rect")
				.attr("width", width)
				.attr("height", height);

			const g = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Plot layer (clipped to axes bounds)
			const plotLayer = g.append("g")
				.attr("clip-path", "url(#scatter-clip)");

			const hoverLayer = g.append("g")
				.attr("clip-path", "url(#scatter-clip)")
				.style("pointer-events", "none");

			const tooltip = d3.select("body")
				.selectAll(".scatter-tooltip")
				.data([null])
				.join("div")
				.attr("class", "scatter-tooltip")
				.style("position", "absolute")
				.style("pointer-events", "none")
				.style("background", "white")
				.style("border", "1px solid #ccc")
				.style("padding", "8px")
				.style("font-size", "12px")
				.style("box-shadow", "0 2px 6px rgba(0,0,0,0.2)")
				.style("display", "none");


			// Scales
			//const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
			//const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
			//const xExtent = d3.extent(data, d => Number(d[xField])) as [number, number];
			const validData = data.filter(d =>
				Number.isFinite(Number(d[xField])) &&
				Number.isFinite(Number(d[yField]))
			);

			const xExtent = d3.extent(validData, d => Number(d[xField])) as [number, number];
			const yExtent = d3.extent(validData, d => Number(d[yField])) as [number, number];

			//const yExtent = d3.extent(data, d => Number(d[yField])) as [number, number];

			const x = d3.scaleLinear()
				.domain(xExtent)
				.nice()
				.range([0, width]);

			const y = d3.scaleLinear()
				.domain(yExtent)
				.nice()
				.range([height, 0]);


			//const normalizedSelected = selectedArtist ? selectedArtist.trim().toLowerCase(): null;
			const normalizedSelected: string | null =
				selectedArtist ? selectedArtist.trim().toLowerCase() : null;

			console.log(
				data.filter(d =>
					d.artist_name.trim().toLowerCase() === normalizedSelected
				)
			);

			// Radius scale (followers -> point size)
			/*
			const followerVals = data
				.map(d => d.artist_followers)
				.filter(v => Number.isFinite(v) && v > 0);

			const followerExtent = d3.extent(followerVals) as [number, number];

			const r = d3.scaleSqrt()
				.domain([
					Math.max(1, followerExtent[0] ?? 1),
					Math.max(2, followerExtent[1] ?? 2)
				])
				.range([2, 10.0]); // Originally 2-4 size range, but increased for better visibility in scatter plot
			*/
			// Dynamic radius scale (based on selected sizeField)
			const sizeVals = data
				.map(d => Number(d[sizeField]))
				.filter(v => Number.isFinite(v) && v > 0);

			const sizeExtent = d3.extent(sizeVals) as [number, number];

			const r = d3.scaleSqrt()
				.domain([
					Math.max(1, sizeExtent[0] ?? 1),
					Math.max(2, sizeExtent[1] ?? 2)
				])
				.range([2, 10]);

			// Axes
			/*
			g.append("g")
				.attr("transform", `translate(0,${height})`)
				.call(d3.axisBottom(x));
			*/
			const xAxis = g.append("g")
				.attr("class", "x-axis")
				.attr("transform", `translate(0,${height})`)
				.call(d3.axisBottom(x));
			
			const yAxis = g.append("g")
				.attr("class", "y-axis")
				.call(d3.axisLeft(y));
			
			// Y-axis should not overlay ontop of rescaling y-scale

		// Auto Y-scaling function (called on zoom)
		const updateYScaleIfNeeded = (zx: d3.ScaleLinear<number, number>) => {
			if (!autoYScaling) return;

			// Only consider points in visible X window
			const [x0, x1] = zx.domain();

			const visible = data.filter(d => {
				const xVal = Number(d[xField]);
				return xVal >= x0 && xVal <= x1;
			});

			if (visible.length === 0) return;

			const yMin = d3.min(visible, d => Number(d[yField]))!;
			const yMax = d3.max(visible, d => Number(d[yField]))!;

			y.domain([
				Math.max(0, Math.floor(yMin)),
				Math.ceil(yMax)
			]).nice();

			//yAxis.call(d3.axisLeft(y));
			yAxis
				.transition()
				.duration(300)
				.ease(d3.easeCubicOut)
				.call(d3.axisLeft(y));

			points
				.transition()
				.duration(300)
				.ease(d3.easeCubicOut)
				.attr("cy", d => y(Number(d[yField] ?? 0)));

			lines.forEach(({ genre, node }) => {
				const subset = data.filter(d => d.genre === genre);
				if (subset.length < 50) return;

				const { slope, intercept } = linearRegression(subset, xField, yField);
				const xExtent = d3.extent(subset, d => Number(d[xField])) as [number, number];

				const y1 = slope * xExtent[0] + intercept;
				const y2 = slope * xExtent[1] + intercept;

				d3.select(node)
					.transition()
					.duration(300)
					.ease(d3.easeCubicOut)
					.attr("y1", y(y1))
					.attr("y2", y(y2));
			});
		};

			//g.append("g").call(d3.axisLeft(y));
			// Removed as y-axis is now dynamic

			// Axis labels
			g.append("text")
				.attr("x", width / 2)
				.attr("y", height + 40)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text(xLabel); //.text(String(xField)); //.text("Artist Popularity (Spotify Score)");

			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -height / 2)
				.attr("y", -45)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text(yLabel); //.text(String(yField)); //.text("Track Popularity (Spotify Score)");

			// Points (de-emphasized)
			// Idea for later (HW 3): Interactivity- showing information in box over mouse
			// info about artist (?)- etc
			// For areas where points overlap heavily, idea:
			/*
				[ Box showing different points in the one spot ]
			*/
			//g.selectAll("circle")
			const points = plotLayer
				.selectAll<SVGCircleElement, Track>("circle")
				//.data(data)
				.data(validData) // Filter out invalid data points for plotting
				.enter()
				.append("circle")
				
				.attr("cx", d => x(Number(d[xField] ?? 0)))
				.attr("cy", d => y(Number(d[yField] ?? 0)))
				.attr("r", d => r(Math.max(1, Number(d[sizeField] ?? 0))))
				//.attr("fill", d => genreColorScale(d.genre))
				//.attr("opacity", 0.28);
				.attr("fill", d => genreColorScale(d.genre))

				.attr("pointer-events", d => {

					const isSelected =
						normalizedSelected !== null &&
						d.artist_name.trim().toLowerCase() === normalizedSelected;

					if (!showArtistPoints && !selectedArtist) return "none";

					if (!showArtistPoints && normalizedSelected !== null && !isSelected)
						return "none";

					if (!genreVisibility.get(d.genre)) return "none";

					return "auto";
				})


				// Opacity logic:
				// - If no artist selected: all points visible at base opacity
				// - If artist selected & showArtistPoints: selected artist fully opaque, others very faint
				// - If artist selected & !showArtistPoints: only selected artist visible, others hidden
				.attr("opacity", d => {
					const isSelected =
						normalizedSelected !== null &&
						d.artist_name.trim().toLowerCase() === normalizedSelected;

					if (isSelected) return 1;

					if (!genreVisibility.get(d.genre)) return 0;

					if (!showArtistPoints) return 0;

					return selectedArtist ? 0.12 : 0.28;
				})

				.attr("stroke", d =>
					normalizedSelected !== null &&
					d.artist_name.trim().toLowerCase() === normalizedSelected
						? "black"
						: "none"
				)
				.attr("stroke-width", d =>
					normalizedSelected !== null &&
					d.artist_name.trim().toLowerCase() === normalizedSelected
						? 2
						: 0
				)

				.on("mousemove", function (event, d) {

					const isSelected =
						normalizedSelected !== null &&
						d.artist_name.trim().toLowerCase() === normalizedSelected;

					// Respect visibility rules FIRST
					if (!showArtistPoints && !selectedArtist) {
						tooltip.style("display", "none");
						hoverLayer.selectAll("*").remove();
						return;
					}

					if (!showArtistPoints && normalizedSelected !== null && !isSelected) {
						tooltip.style("display", "none");
						hoverLayer.selectAll("*").remove();
						return;
					}

					hoverLayer.selectAll("*").remove();

					hoverLayer.append("circle")
						.attr("cx", x(Number(d[xField])))
						.attr("cy", y(Number(d[yField])))
						.attr("r", r(Math.max(1, Number(d[sizeField]))) + 2)
						.attr("fill", "none")
						.attr("stroke", isSelected ? "gold" : invertColor(genreColorScale(d.genre)))
						.attr("stroke-width", 4)
						.attr("stroke-opacity", 1)
						.attr("vector-effect", "non-scaling-stroke");

					const subgenres = d.rawGenres
						? d.rawGenres.split(",").map(s => s.trim()).filter(Boolean)
						: [];

					tooltip
						.style("display", "block")
						.style("left", event.pageX + 12 + "px")
						.style("top", event.pageY - 28 + "px")
						.html(`
							<div><strong>Track:</strong> ${d.track_name}</div>
							<div><strong>Artist:</strong> ${d.artist_name}</div>
							<div><strong>Duration:</strong> ${formatDuration(d.duration_ms)}</div>
							<div><strong>Release Year:</strong> ${d.release_year}</div>
							<div><strong>Genre Family:</strong> ${d.genre}</div>
							<div><strong>Subgenres:</strong> ${
								subgenres.length ? subgenres.slice(0, 6).join(", ") : "None"
							}</div>
							<div><strong>Track Popularity:</strong> ${d.track_popularity}</div>
							<div><strong>Artist Popularity:</strong> ${d.artist_popularity}</div>
							<div><strong>Followers:</strong> ${d.artist_followers.toLocaleString()}</div>
						`);
				}) .on("mouseleave", function () {
					hoverLayer.selectAll("*").remove();
					tooltip.style("display", "none");
				});

			if (normalizedSelected !== null) {
				points
					.filter(d =>
						d.artist_name.trim().toLowerCase() === normalizedSelected
					)
					.raise();
			}

			// Per-genre linear trend regression lines (visual guides)
			/*
			GENRES.forEach(genre => {
				const subset = data.filter(d => d.genre === genre);
				if (subset.length < 50) return;

				const { slope, intercept } = linearRegression(subset);

				const xExtent = d3.extent(subset, d => d.artist_popularity) as [number, number];
				const y1 = slope * xExtent[0] + intercept;
				const y2 = slope * xExtent[1] + intercept;

				g.append("line")
					.attr("x1", x(xExtent[0]))
					.attr("y1", y(y1))
					.attr("x2", x(xExtent[1]))
					.attr("y2", y(y2))
					.attr("stroke", genreColorScale(genre))
					.attr("stroke-width", 3.5)
					.attr("opacity", 1);
			});
			*/
			//const lines: SVGLineElement[] = [];
			// Issue: Storing bare DOM nodes --> can't easily update with D3
			// Fix: Store objects ineads
			const lines: { genre: string; node: SVGLineElement }[] = [];


			GENRES.forEach(genre => {
				const subset = validData.filter(d => d.genre === genre); // data swapped for validData
				if (subset.length < 50) return;

				const { slope, intercept } = linearRegression(subset, xField, yField);

				const xExtent = d3.extent(subset, d => Number(d[xField])) as [number, number];
				const y1 = slope * xExtent[0] + intercept;
				const y2 = slope * xExtent[1] + intercept;
				const line = plotLayer.append("line")
					.attr("x1", x(xExtent[0]))
					.attr("y1", y(y1))
					.attr("x2", x(xExtent[1]))
					.attr("y2", y(y2))
					.attr("stroke", genreColorScale(genre))
					.attr("stroke-width", 3.5)
					.attr("pointer-events", "none") // Stop mouse events from interfering with points
					//.attr("opacity", showArtistLines ? 1 : 0);
					.attr("opacity", showArtistLines && genreVisibility.get(genre) ? 1 : 0); // Lines also respect genre visibility toggling
					

				//lines.push(line.node() as SVGLineElement);
				// Object lines fix:
				lines.push({
					genre,
					node: line.node() as SVGLineElement
				});

			});



			// SELECTED ARTIST REGRESSION LINE
			if (normalizedSelected !== null) {

				const artistSubset = validData.filter(d =>
					d.artist_name.trim().toLowerCase() === normalizedSelected
				);

				if (artistSubset.length >= 2) {

					const { slope, intercept } =
						linearRegression(artistSubset, xField, yField);

					const xDomain = x.domain();

					const y1 = slope * xDomain[0] + intercept;
					const y2 = slope * xDomain[1] + intercept;

					const artistLine = plotLayer.append("line")
						.attr("x1", x(xDomain[0]))
						.attr("y1", y(y1))
						.attr("x2", x(xDomain[1]))
						.attr("y2", y(y2))
						.attr("stroke", "black")
						.attr("stroke-width", 4.5)
						.attr("opacity", 1)
						.attr("pointer-events", "none")
						.attr("vector-effect", "non-scaling-stroke");

					// Always render ABOVE genre lines
					artistLine.raise();

					// Save for zoom updating
					lines.push({
						genre: "__artist__",
						node: artistLine.node() as SVGLineElement
					});
				}
			}

			// POINT SIZE LEGEND (TOP RIGHT) ---------------------------
			const sizeLegend = g.append("g")
				.attr("transform", `translate(${width - 260}, -20)`);

			const minVal = sizeExtent[0] ?? 1;
			const maxVal = sizeExtent[1] ?? 1;

			const minLabel = formatSizeValue(minVal, sizeField);
			const maxLabel = formatSizeValue(maxVal, sizeField);

			// Left min value
			sizeLegend.append("text")
				.attr("x", 0)
				.attr("y", 4)
				.attr("font-size", "11px")
				.attr("text-anchor", "start")
				.text(minLabel);

			// Small circle
			sizeLegend.append("circle")
				.attr("cx", 50)
				.attr("cy", 0)
				.attr("r", r(minVal))
				.attr("fill", "white")
				.attr("stroke", "black");

			// Arrow line
			sizeLegend.append("line")
				.attr("x1", 70)
				.attr("y1", 0)
				.attr("x2", 130)
				.attr("y2", 0)
				.attr("stroke", "black")
				.attr("stroke-width", 1.5);

			// Arrow head
			sizeLegend.append("path")
				.attr("d", "M 130 -4 L 138 0 L 130 4")
				.attr("fill", "black");

			// Big circle
			sizeLegend.append("circle")
				.attr("cx", 160)
				.attr("cy", 0)
				.attr("r", r(maxVal))
				.attr("fill", "white")
				.attr("stroke", "black");

			// Max value text
			sizeLegend.append("text")
				.attr("x", 185)
				.attr("y", 4)
				.attr("font-size", "11px")
				.attr("text-anchor", "start")
				.text(maxLabel);
/*
			// Variable label (bold)
			sizeLegend.append("text")
				.attr("x", 235)
				.attr("y", 4)
				.attr("font-size", "11px")
				.attr("font-weight", "bold")
				.text(xLabel === yLabel ? formatSizeValue(maxVal, sizeField) : formatSizeLabel(sizeField));
*/
			// ---------------------------------------
			// Legend
			const legend = g.append("g")
				.attr("transform", `translate(${width + 10}, 0)`);

			// Selected legend artist
			let legendOffset = 0;

			if (selectedArtist) {

				const row = legend.append("g")
					.attr("transform", `translate(0, 0)`);

				row.append("circle")
					.attr("cx", 5)
					.attr("cy", 5)
					.attr("r", 5)
					.attr("fill", "white")
					.attr("stroke", "black")
					.attr("stroke-width", 2);

				row.append("text")
					.attr("x", 14)
					.attr("y", 9)
					.attr("font-size", "10px")
					.attr("font-weight", "bold")
					.text(`${selectedArtist}`);

				legendOffset = 20;  // push genre rows down
			}


			GENRES.forEach((genre, i) => {
				const row = legend.append("g")
					.attr("transform", `translate(0, ${i * 16 + legendOffset})`) //.attr("transform", `translate(0, ${i * 16})`)
					.style("cursor", "pointer");

				const rect = row.append("rect")
					.attr("width", 10)
					.attr("height", 10)
					.attr("fill", genreColorScale(genre));

				const text = row.append("text")
					.attr("x", 14)
					.attr("y", 9)
					.attr("font-size", "10px")
					.text(genre);

				// Hover behavior
				row.on("mouseenter", function () {

					text.attr("font-weight", "bold");

					points.transition()
						.duration(120)
						.attr("opacity", (p: Track) =>
							p.genre === genre ? 1 : 0.1
						);

					lines.forEach(({ genre: g, node }) => {

						// NEVER hide selected artist regression
						if (g === "__artist__") {
							d3.select(node).attr("opacity", 1);
							return;
						}

						d3.select(node)
							.attr("opacity", g === genre ? 1 : 0);
					});

				});

				row.on("mouseleave", function () {

					text.attr("font-weight", "normal");

					points.transition()
						.duration(120)
						.attr("opacity", (p: Track) => {
							const isSelected =
								normalizedSelected !== null &&
								p.artist_name.trim().toLowerCase() === normalizedSelected;

							if (isSelected) return 1;
							if (!genreVisibility.get(p.genre)) return 0;
							if (!showArtistPoints) return 0;
							return selectedArtist ? 0.12 : 0.28;
						});

					lines.forEach(({ genre: g, node }) => {

						if (g === "__artist__") {
							d3.select(node).attr("opacity", 1);
							return;
						}

						d3.select(node)
							.attr("opacity",
								showArtistLines && genreVisibility.get(g) ? 1 : 0
							);
					});

				});


				// Click toggle
				row.on("click", () => {
					const current = genreVisibility.get(genre)!;
					const newState = !current;

					genreVisibility.set(genre, newState);

					row.transition()
						.duration(150)
						.style("opacity", newState ? 1 : 0.35);

					text.style("text-decoration",
						newState ? "none" : "line-through"
					);

					// Update points
					points.attr("opacity", d => {
						const isSelected =
							normalizedSelected !== null &&
							d.artist_name.trim().toLowerCase() === normalizedSelected;

						if (isSelected) return 1;
						if (!genreVisibility.get(d.genre)) return 0;
						if (!showArtistPoints) return 0;
						return selectedArtist ? 0.12 : 0.28;
					});

					// Update lines
					lines.forEach(({ genre: g, node }) => {
						d3.select(node)
							.attr("opacity",
								showArtistLines && genreVisibility.get(g) ? 1 : 0
							);
					});
				});
			});

			const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([1, 8])
			.translateExtent([[0, 0], [width, height]])
			.extent([[0, 0], [width, height]])
			.on("zoom", (event) => {
				currentTransform = event.transform;

				const zx = event.transform.rescaleX(x);

				// Update X axis
				xAxis.call(d3.axisBottom(zx));

				// Optional Y rescaling (scatter-safe)
				updateYScaleIfNeeded(zx);

				// Update points
				points
					//.attr("cx", d => zx(d.artist_popularity))
					//.attr("cy", d => y(d.track_popularity));
					.attr("cx", d => zx(Number(d[xField] ?? 0)))
					.attr("cy", d => y(Number(d[yField] ?? 0)));

				// Update trend lines
				lines.forEach(({ genre, node }) => {

					let subset: Track[];

					if (genre === "__artist__" && normalizedSelected !== null) {
						subset = validData.filter(d =>
							d.artist_name.trim().toLowerCase() === normalizedSelected
						);
					} else {
						subset = validData.filter(d => d.genre === genre);
					}

					if (subset.length < 2) return;

					const { slope, intercept } =
						linearRegression(subset, xField, yField);

					const xDomain = zx.domain();

					const y1 = slope * xDomain[0] + intercept;
					const y2 = slope * xDomain[1] + intercept;

					d3.select(node)
						.attr("x1", zx(xDomain[0]))
						.attr("y1", y(y1))
						.attr("x2", zx(xDomain[1]))
						.attr("y2", y(y2));
				});
			});

			svg.call(zoom as any);
		};

		draw();

		const onResize = () => draw();
		window.addEventListener("resize", onResize);

		return () => {
			window.removeEventListener("resize", onResize);
		};

	}, [
		data,
		selectedArtist,
		showArtistPoints,
		showArtistLines,
		xField,
		yField,
		sizeField,
		xLabel,
		yLabel
	]);

	return <svg id="scatter-svg"></svg>;
}