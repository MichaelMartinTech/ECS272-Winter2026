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

export default function ScatterTrend({ data }: { data: Track[] }) {

	// SCATTER PLOT + TRENDLINES
	useEffect(() => {
		if (!data) return;

		const svg = d3.select("#scatter-svg");

		const draw = () => {
			svg.selectAll("*").remove();

			const margin = { top: 30, right: 140, bottom: 50, left: 60 };
			const svgNode = svg.node() as SVGSVGElement;

			const width = svgNode.clientWidth - margin.left - margin.right;
			const height = svgNode.clientHeight - margin.top - margin.bottom;

			if (width <= 0 || height <= 0) return;

			const g = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Scales
			const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
			const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

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
				.range([1.0, 4.0]);

			// Axes
			g.append("g")
				.attr("transform", `translate(0,${height})`)
				.call(d3.axisBottom(x));

			g.append("g").call(d3.axisLeft(y));

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
			g.selectAll("circle")
				.data(data)
				.enter()
				.append("circle")
				.attr("cx", d => x(d.artist_popularity))
				.attr("cy", d => y(d.track_popularity))
				.attr("r", d => r(Math.max(1, d.artist_followers)))
				.attr("fill", d => genreColorScale(d.genre))
				.attr("opacity", 0.28);

			// Per-genre linear trend regression lines (visual guides)
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
		};

		draw();

		const onResize = () => draw();
		window.addEventListener("resize", onResize);

		return () => {
			window.removeEventListener("resize", onResize);
		};

	}, [data]);

	return <svg id="scatter-svg"></svg>;
}