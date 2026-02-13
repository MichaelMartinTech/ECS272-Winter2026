import { useEffect } from "react";
import * as d3 from "d3";
import { GENRES, genreColorScale } from "../../colors";
import type { Track } from "../Dashboard";

function linearRegression(points: Track[]) {
	const n = points.length;
	const meanX = d3.mean(points, d => d.artist_popularity)!;
	const meanY = d3.mean(points, d => d.track_popularity)!;
	// Calculate slope (m) and intercept (b) for y = mx + b
	let num = 0;
	let den = 0;

	points.forEach(d => {
		num += (d.artist_popularity - meanX) * (d.track_popularity - meanY);
		den += (d.artist_popularity - meanX) ** 2;
	});

	const slope = num / den;
	const intercept = meanY - slope * meanX;

	return { slope, intercept };
}

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

export default function ScatterTrend({
	data,
	selectedArtist,
	showArtistPoints,
	showArtistLines
}: {
	data: Track[];
	selectedArtist: string | null;
	showArtistPoints: boolean;
	showArtistLines: boolean;
}) {



	// SCATTER PLOT + TRENDLINES
	useEffect(() => {
		if (!data) return;
		const svg = d3.select("#scatter-svg");

		const draw = () => {
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
			const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
			const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

			//const normalizedSelected = selectedArtist ? selectedArtist.trim().toLowerCase(): null;
			const normalizedSelected: string | null =
				selectedArtist ? selectedArtist.trim().toLowerCase() : null;

			console.log(
				data.filter(d =>
					d.artist_name.trim().toLowerCase() === normalizedSelected
				)
			);

			// Radius scale (followers -> point size)
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

			const visible = data.filter(d =>
				d.artist_popularity >= x0 &&
				d.artist_popularity <= x1
			);

			if (visible.length === 0) return;

			const yMin = d3.min(visible, d => d.track_popularity)!;
			const yMax = d3.max(visible, d => d.track_popularity)!;

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
				.attr("cy", d => y(d.track_popularity));

			lines.forEach(({ genre, node }) => {
				const subset = data.filter(d => d.genre === genre);
				if (subset.length < 50) return;

				const { slope, intercept } = linearRegression(subset);
				const xExtent = d3.extent(subset, d => d.artist_popularity) as [number, number];

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
				.text("Artist Popularity (Spotify Score)");

			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -height / 2)
				.attr("y", -45)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Track Popularity (Spotify Score)");

			// Points (de-emphasized)
			// Idea for later (HW 3): Interactivity- showing information in box over mouse
			// info about artist (?)- etc
			// For areas where points overlap heavily, idea:
			/*
				[ Box showing different points in the one spot ]
			*/
			//g.selectAll("circle")

			const points = plotLayer.selectAll("circle") //g.selectAll("circle")
				.data(data)
				.enter()
				.append("circle")
				.attr("cx", d => x(d.artist_popularity))
				.attr("cy", d => y(d.track_popularity))
				.attr("r", d => r(Math.max(1, d.artist_followers)))
				//.attr("fill", d => genreColorScale(d.genre))
				//.attr("opacity", 0.28);
				.attr("fill", d => genreColorScale(d.genre))

				.attr("opacity", d => {

				const isSelected =
					normalizedSelected !== null &&
					d.artist_name.trim().toLowerCase() === normalizedSelected;

					// Always show selected artist
					if (isSelected) return 1;

					// If points disabled, hide everything else
					if (!showArtistPoints) return 0;

					// Otherwise normal behavior
					return selectedArtist ? 0.12 : 0.28;
				})

				.attr("stroke", d =>
					selectedArtist &&
					d.artist_name.trim().toLowerCase() === normalizedSelected
						? "black"
						: "none"
				)
				.attr("stroke-width", d =>
					selectedArtist &&
					d.artist_name.trim().toLowerCase() === normalizedSelected
						? 2
						: 0
				)

				.on("mousemove", function (event, d) {

					const isSelected =
						selectedArtist &&
						d.artist_name.trim().toLowerCase() === normalizedSelected;

					// Only show tooltip for selected artist
					if ((!isSelected && !showArtistPoints) || (!isSelected && selectedArtist)) {
						tooltip.style("display", "none");
						return;
					}

					const subgenres = d.rawGenres
						? d.rawGenres.split(",").map(s => s.trim()).filter(Boolean)
						: [];

					tooltip
						.style("display", "block")
						.style("left", event.pageX + 12 + "px")
						.style("top", event.pageY - 28 + "px")
						.html(`
							<div style="margin-bottom:4px;">
								<strong>Track:</strong> ${d.track_name}
							</div>
							<div><strong>Artist:</strong> ${d.artist_name}</div>
							<div><strong>Duration:</strong> ${formatDuration(d.duration_ms)}</div>
							<div><strong>Genre Family:</strong> ${d.genre}</div>
							<div><strong>Subgenres:</strong> ${
								subgenres.length ? subgenres.slice(0, 6).join(", ") : "None"
							}</div>
							<div><strong>Track Popularity:</strong> ${d.track_popularity}</div>
							<div><strong>Artist Popularity:</strong> ${d.artist_popularity}</div>
							<div><strong>Followers:</strong> ${d.artist_followers.toLocaleString()}</div>
						`);
				})
				.on("mouseleave", () => {
					tooltip.style("display", "none");
				});

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
				const subset = data.filter(d => d.genre === genre);
				if (subset.length < 50) return;

				const { slope, intercept } = linearRegression(subset);

				const xExtent = d3.extent(subset, d => d.artist_popularity) as [number, number];
				const y1 = slope * xExtent[0] + intercept;
				const y2 = slope * xExtent[1] + intercept;
				const line = plotLayer.append("line") //g.append("line")
					.attr("x1", x(xExtent[0]))
					.attr("y1", y(y1))
					.attr("x2", x(xExtent[1]))
					.attr("y2", y(y2))
					.attr("stroke", genreColorScale(genre))
					.attr("stroke-width", 3.5)
					.attr("opacity", showArtistLines ? 1 : 0);

				//lines.push(line.node() as SVGLineElement);
				// Object lines fix:
				lines.push({
					genre,
					node: line.node() as SVGLineElement
				});

			});


			// Legend
			const legend = g.append("g")
				.attr("transform", `translate(${width + 10}, 0)`);

			GENRES.forEach((genre, i) => {
				const row = legend.append("g")
					.attr("transform", `translate(0, ${i * 16})`);

				row.append("rect")
					.attr("width", 10)
					.attr("height", 10)
					.attr("fill", genreColorScale(genre));

				row.append("text")
					.attr("x", 14)
					.attr("y", 9)
					.attr("font-size", "10px")
					.text(genre);
			});

			if (selectedArtist) {
				const row = legend.append("g")
					.attr("transform", `translate(0, ${GENRES.length * 16 + 10})`);

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
					.text(`${selectedArtist} (Artist)`);
			}

			// Explanatory annotation (top-left, inside plot)
			const note = g.append("g")
				.attr("transform", "translate(20, 10)");

			note.append("rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 270)
				.attr("height", 52)
				.attr("fill", "#f8f8f8")
				.attr("stroke", "#ccc")
				.attr("rx", 4)
				.attr("opacity", 0.9);

			note.append("text")
				.attr("x", 8)
				.attr("y", 18)
				.attr("font-size", "10px")
				.text("Points: individual tracks (size scaled by artist followers)");

			note.append("text")
				.attr("x", 8)
				.attr("y", 34)
				.attr("font-size", "10px")
				.text("Lines: per-genre linear least-squares fit");
			
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
					.attr("cx", d => zx(d.artist_popularity));

				// Update trend lines
				lines.forEach(({ genre, node }) => {
					const subset = data.filter(d => d.genre === genre);
					if (subset.length < 50) return;

					const { slope, intercept } = linearRegression(subset);
					const xExtent = d3.extent(subset, d => d.artist_popularity) as [number, number];

					const y1 = slope * xExtent[0] + intercept;
					const y2 = slope * xExtent[1] + intercept;

					d3.select(node)
						/*
						.attr("x1", zx(xExtent[0]))
						.attr("y1", y(y1))
						.attr("x2", zx(xExtent[1]))
						.attr("y2", y(y2));
						*/
						// Handle Y only by updateYScaleIfNeeded
						.attr("x1", zx(xExtent[0]))
						.attr("x2", zx(xExtent[1]));
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

	}, [data, selectedArtist, showArtistPoints, showArtistLines]);

	return <svg id="scatter-svg"></svg>;
}