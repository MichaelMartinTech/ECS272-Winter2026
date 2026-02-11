// Changes to make: color 'fill' in gap areas when untoggling genres

import { useEffect } from "react";
import * as d3 from "d3";
import { GENRES, genreColorScale } from "../../colors";
import type { Track } from "../Dashboard";

type YearGenreRow = {
	year: number;
	[key: string]: number;
};

export default function StreamGraph({ data }: { data: Track[] }) {
	useEffect(() => { // Check if data is available
		if (!data) return;

		const svg = d3.select("#streamgraph-svg");

		const draw = () => {
			svg.selectAll("*").remove();

			// Set up margins and dimensions
			const margin = { top: 30, right: 140, bottom: 40, left: 60 };
			const svgNode = svg.node() as SVGSVGElement;

			const width = svgNode.clientWidth - margin.left - margin.right;
			const height = svgNode.clientHeight - margin.top - margin.bottom;

			if (width <= 0 || height <= 0) return;

			const g = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Decide tick format based on actual tick values
			const adaptiveTickFormat = (scale: d3.ScaleLinear<number, number>) => {
				const ticks = scale.ticks(8);

				const hasDecimal = ticks.some(t => Math.abs(t - Math.round(t)) > 1e-6);

				if (!hasDecimal) {
					return d3.format("d");
				}

				return (d: number) => {
					return Math.abs(d - Math.round(d)) < 1e-6
						? d3.format("d")(d)
						: d3.format(".2f")(d);
				};
			};

			// Clip path to prevent layers from drawing outside plot bounds
			const defs = svg.append("defs");

			// clip
			defs.append("clipPath")
			.attr("id", "stream-clip")
			.append("rect")
			.attr("width", width)
			.attr("height", height);

			// stripes
			/*
			defs.append("pattern")
			.attr("id", "hover-stripes")
			.attr("patternUnits", "userSpaceOnUse")
			.attr("width", 6)
			.attr("height", 6)
			.attr("patternTransform", "rotate(45)")
			.append("line")
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", 0)
			.attr("y2", 6)
			.attr("stroke", "rgba(255,255,255,0.6)")
			.attr("stroke-width", 1);
			*/

			// Filter data to valid years observed in dataset
			const filtered = data.filter(d =>
				d.release_year >= 1950 && d.release_year <= 2025
			);

			// Aggregate by year and genre
			const years = Array.from(
				new Set(filtered.map(d => d.release_year))
			).sort((a, b) => a - b);

			const aggregated: YearGenreRow[] = years.map(year => {
				const row: YearGenreRow = { year };

				GENRES.forEach(genre => {
					row[genre] = filtered.filter(
						d => d.release_year === year && d.genre === genre
					).length;
				});

				return row;
			});

			// X scale (temporal)
			const x = d3.scaleLinear()
				.domain(d3.extent(years) as [number, number])
				.range([0, width]);

			// Stream stack configuration
			const stack = d3.stack<YearGenreRow>()
				.keys(GENRES)
				.offset(d3.stackOffsetWiggle);

			const layers = stack(aggregated);

			// Compute raw vertical extent produced by stream stacking
			const rawYMin = d3.min(layers, layer => d3.min(layer, d => d[0]))!;
			const rawYMax = d3.max(layers, layer => d3.max(layer, d => d[1]))!;

			// Round outward to preserve extrema
			const yMin = Math.floor(rawYMin);
			const yMax = Math.ceil(rawYMax);

			// Y scale (relative genre prevalence)
			const y = d3.scaleLinear()
				.domain([yMin, yMax])
				.range([height, 0])
				.nice(); // produce clean integer tick steps

			// Axes
			// Class names - For later selection
			const xAxis = g.append("g")
				.attr("class", "x-axis")
				.attr("transform", `translate(0,${height})`)
				.call(
					d3.axisBottom(x)
						.ticks(10)
						.tickFormat(d3.format("d"))
				);

			const yAxis = g.append("g")
				.attr("class", "y-axis")
				.call(
					d3.axisLeft(y)
						.ticks(8)
						.tickFormat(d3.format("d"))
				);

			// to support temporal traversal and localized genre inspection

			// Area generator - Will be reused later
			const area = d3.area<any>()
				.x(d => x(d.data.year))
				.y0(d => y(d[0]))
				.y1(d => y(d[1]))
				.curve(d3.curveCatmullRom);

			// Draw stream layers
			/*
			const paths = g.selectAll(".layer")
				.data(layers)
				.enter()
				.append("path")
				.attr("class", "layer")
				.attr("d", area)
				.attr("fill", d => genreColorScale(d.key))
				.attr("opacity", 0.9);
			*/
			const layerGroup = g.append("g")
				.attr("clip-path", "url(#stream-clip)");

			const paths = layerGroup.selectAll(".layer")
				.data(layers)
				.enter()
				.append("path")
				.attr("class", "layer")
				.attr("d", area)
				.attr("fill", d => genreColorScale(d.key))
				.attr("opacity", 0.9);

			const hoverLayer = layerGroup.selectAll(".hover-layer")
				.data(layers)
				.enter()
				.append("path")
				.attr("class", "hover-layer")
				.attr("d", area)
				.attr("fill", "url(#hover-stripes)")
				.attr("opacity", 0)
				.style("pointer-events", "none"); // important

			// Track genre visibility (true = emphasized)
			const genreVisibility = new Map<string, boolean>();

			// Magnitude rescaling toggle (true = dynamic Y-scale)
			let magnitudeScalingEnabled = true;

			GENRES.forEach(g => genreVisibility.set(g, true));

			// Zoom + pan interaction (horizontal only)
			// Zooming recomputes Y-scale based on visible temporal window

			// Idea: Add a small button that shows UI for changing visualization (Accessibility) - Maybe a TOGGLE for magnitude rescaling on/off (Y-axis domain fixed to global vs dynamic based on visible window)
			// Also: Add toggle to hide things for magnitude view, it'll really help show differences better.
			let rafId = 0;
			let currentTransform = d3.zoomIdentity;

			const updateLegendVisuals = () => {
			legend.selectAll("g").each(function(_, i) {
				const genre = GENRES[i];
				const active = genreVisibility.get(genre);

				d3.select(this).select("rect")
				.transition()
				.duration(150)
				.attr("opacity", active ? 1 : 0.25);

				d3.select(this).select("text")
				.transition()
				.duration(150)
				.attr("opacity", active ? 1 : 0.35)
				.attr("font-weight", "normal");

			});
			};

			// Recompute Y-scale + redraw using current visibility + zoom state
			const updateYScaleAndRedraw = (
				zx: d3.ScaleLinear<number, number>,
				x0: number,
				x1: number
			) => {

				paths
					/*
					.attr("fill", d =>
						genreVisibility.get(d.key)
						? genreColorScale(d.key)
						: genreColorScale(d.key)
					)
					*/
				//.attr("stroke", d => genreVisibility.get(d.key) ? "url(#diagonal-stripes)" : "none")
				//.attr("stroke-width", d => genreVisibility.get(d.key) ? 2 : 0);


				// Update visual styling first (single source of truth for visibility) 
				// ...before recomputing Y-domain to reflect changes immediately
				const visiblePoints = layers.flatMap(layer => {
					if (!genreVisibility.get(layer.key)) return [];
					return layer.filter(d =>
						d.data.year >= x0 && d.data.year <= x1
					);
				});

				if (visiblePoints.length === 0) return;

				const vMin = d3.min(visiblePoints, d => d[0])!;
				const vMax = d3.max(visiblePoints, d => d[1])!;

				// Y-Domain logic
				if (magnitudeScalingEnabled) {
					y.domain([Math.floor(vMin), Math.ceil(vMax)]).nice();
				} else {
					y.domain([yMin, yMax]).nice(); // restore global scale
				}

				const ySpan = Math.abs(vMax - vMin);
				const yTickFormat = adaptiveTickFormat(y);
				const yTicks = ySpan < 10 ? 6 : ySpan < 50 ? 7 : 8;

				yAxis.transition()
					.duration(200)
					.ease(d3.easeCubicOut)
					.call(
						d3.axisLeft(y)
							.ticks(yTicks)
							.tickFormat(yTickFormat as any)
					);

				paths.transition()
				.duration(200)
				.ease(d3.easeCubicOut)
				.attr("opacity", d => genreVisibility.get(d.key) ? 0.9 : 0.1)
				.attr("d", d3.area<any>()
					.x(d => zx(d.data.year))
					.y0(d => y(d[0]))
					.y1(d => y(d[1]))
					.curve(d3.curveCatmullRom)
				);

			};

			// D3's built-in zoom behavior with custom constraints and event handling
			const zoom = d3.zoom<SVGSVGElement, unknown>()
				.scaleExtent([1, 8])
				.translateExtent([[0, 0], [width, height]])
				.extent([[0, 0], [width, height]])
				.on("zoom", (event) => {
					currentTransform = event.transform;
					if (rafId) cancelAnimationFrame(rafId);

					rafId = requestAnimationFrame(() => {
						rafId = 0;

						const zx = event.transform.rescaleX(x);
						xAxis.call(
							d3.axisBottom(zx)
								.ticks(10)
								.tickFormat(d3.format("d"))
						);

						const [x0, x1] = zx.domain();
						minYearLabel
							.attr("x", zx(x0) + 6)
							.text(Math.round(x0));
						maxYearLabel
							.attr("x", zx(x1) - 6)
							.text(Math.round(x1));

						updateYScaleAndRedraw(zx, x0, x1);
					});
				});

			/*
			// Explicit start / end year labels anchored inside plot bounds
			const startYear = years[0];
			const endYear = years[years.length - 1];

			g.append("text")
				.attr("x", x(startYear) + 6)
				.attr("y", height + 28)
				.attr("text-anchor", "start")
				.attr("font-size", "10px")
				.text(startYear);

			g.append("text")
				.attr("x", x(endYear) - 6)
				.attr("y", height + 28)
				.attr("text-anchor", "end")
				.attr("font-size", "10px")
				.text(endYear);
			*/ // Removed for dynamic start and end year text

			// Dynamic visible range labels (updated on zoom)
			const minYearLabel = g.append("text")
				.attr("class", "min-year-label")
				.attr("y", height + 28)
				.attr("text-anchor", "start")
				.attr("font-size", "10px");

			const maxYearLabel = g.append("text")
				.attr("class", "max-year-label")
				.attr("y", height + 28)
				.attr("text-anchor", "end")
				.attr("font-size", "10px");

			// Initialize visible year labels on first render
			const [x0Init, x1Init] = x.domain();
			

			minYearLabel
				.attr("x", x(x0Init) + 6)
				.text(Math.round(x0Init));

			maxYearLabel
				.attr("x", x(x1Init) - 6)
				.text(Math.round(x1Init));

			// Legend
			const legend = g.append("g")
				.attr("transform", `translate(${width + 10}, 0)`);

			GENRES.forEach((genre, i) => {
				const row = legend.append("g")
				.attr("transform", `translate(0, ${i * 16})`)
				.style("cursor", "pointer")

				.on("mouseenter", function () {
					// bold text
					d3.select(this).select("text")
					.attr("font-weight", "bold");

					// dim other streams
					paths
					.transition()
					.duration(120)
					.attr("opacity", d => d.key === genre ? 1 : 0.4);
				})

				.on("mouseleave", function () {
					// unbold text
					d3.select(this).select("text")
					.attr("font-weight", "normal");

					// restore stream opacity
					paths
					.transition()
					.duration(120)
					.attr("opacity", d =>
						genreVisibility.get(d.key) ? 0.9 : 0.1
					);
				})

				.on("click", () => {
					const current = genreVisibility.get(genre)!;
					genreVisibility.set(genre, !current);

					const zx = currentTransform.rescaleX(x);
					const [x0, x1] = zx.domain();
					updateYScaleAndRedraw(zx, x0, x1);
					updateLegendVisuals();
				});


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

			// Initial Y-scale sync (important for toggle correctness) after legend exists
			updateYScaleAndRedraw(x, x0Init, x1Init);
			updateLegendVisuals();

			// Magnitude scale toggle button
			const toggleGroup = g.append("g")
				.attr("transform", `translate(${width - 120}, ${height + 24})`)
				.style("cursor", "pointer");

			const toggleRect = toggleGroup.append("rect")
				.attr("width", 110)
				.attr("height", 18)
				.attr("rx", 4)
				.attr("fill", "#eaeaea")
				.attr("stroke", "#aaa");

			const toggleText = toggleGroup.append("text")
				.attr("x", 8)
				.attr("y", 13)
				.attr("font-size", "10px")
				.text("Magnitude scaling: ON");

			toggleGroup.on("click", () => {
				magnitudeScalingEnabled = !magnitudeScalingEnabled;

				toggleText.text(
					`Magnitude scaling: ${magnitudeScalingEnabled ? "ON" : "OFF"}`
				);

				// Force immediate recompute using current zoom state
				const zx = currentTransform.rescaleX(x);
				const [x0, x1] = zx.domain();

				updateYScaleAndRedraw(zx, x0, x1);
				updateLegendVisuals();
			});

			// Explanatory annotation
			const note = g.append("g")
				.attr("transform", "translate(20, 10)");

			note.append("rect")
				.attr("width", 330)
				.attr("height", 34)
				.attr("fill", "#f8f8f8")
				.attr("stroke", "#ccc")
				.attr("rx", 4)
				.attr("opacity", 0.9);

			note.append("text")
				.attr("x", 8)
				.attr("y", 22)
				.attr("font-size", "11px")
				.text("Area height: relative genre prevalence per year (wiggle-offset)");

			// X-axis label
			g.append("text")
				.attr("x", width / 2)
				.attr("y", height + 38)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Release Year");
			// Y-axis label
			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -height / 2)
				.attr("y", -45)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Relative Genre Prevalence (Wiggle-Offset)");

			// Apply zoom behavior to SVG
			svg.call(zoom as any); // Type assertion to bypass D3's complex typings for zoom behavior
		};

		draw();

		const onResize = () => draw();
		window.addEventListener("resize", onResize);

		return () => {
			window.removeEventListener("resize", onResize);
		};

	}, [data]);

	return <svg id="streamgraph-svg"></svg>;
}