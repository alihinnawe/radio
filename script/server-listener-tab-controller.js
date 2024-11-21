import TabController from "../../../tool/tab-controller.js";
import { shuffle } from "../../../tool/math.js";
import { sleep } from "../../../tool/threads.js";


/**
 * Server listener tab controller type.
 */
class ServerListenerTabController extends TabController {
	static #RAPID_API_KEY = "6b614363a0mshbbd38a963ab23c6p1eaf6djsn05c146e77155";
	static #RAPID_API_PROTOCOL = "https:";
	static #RAPID_API_HOSTNAME = "genius-song-lyrics1.p.rapidapi.com";
	static #RAPID_API_ORIGIN = ServerListenerTabController.#RAPID_API_PROTOCOL + "//" + ServerListenerTabController.#RAPID_API_HOSTNAME;
	static #SECOND_MILLIES = 1000;
	#trackSources;
	#trackPlaylist;


	/**
	 * Initializes a new instance.
	 */
	constructor () {
		super("server-listener");
		this.#trackSources = [];
		this.#trackPlaylist = [];

		// register controller event listeners 
		this.addEventListener("activated", event => this.processActivated());
		this.addEventListener("deactivated", event => this.processDeactivated());
	}


	// getter operations
	get audioMixer () { return this.sharedProperties["audio-context"]; }
	get trackSources () { return this.#trackSources; }

	get querySectionTemplate () { return document.querySelector("head>template.server-listener-query"); }
	get querySection () { return this.center.querySelector("section.server-listener-query"); }
	get queryButton () { return this.querySection.querySelector("div.control>button.query"); }
	get artistSelector () { return this.querySection.querySelector("div.criteria>span.artist>select"); }
	get genreSelector () { return this.querySection.querySelector("div.criteria>span.genre>select"); }
	get controlSpan () { return this.querySection.querySelector("div.criteria>span.control"); }
	get masterVolumeInput () { return this.controlSpan.querySelector("input.volume"); }
	get compressionRatioInput () { return this.controlSpan.querySelector("input.compression-ratio"); }
	get crossfadeDurationInput () { return this.controlSpan.querySelector("input.crossfade"); }

	get playlistSectionTemplate () { return document.querySelector("head>template.server-listener-playlist"); }
	get playlistTableRowTemplate () { return document.querySelector("head>template.server-listener-playlist-row"); }
	get playlistSection () { return this.center.querySelector("section.server-listener-playlist"); }
	get tracksTableBody () { return this.playlistSection.querySelector("span.tracks>div>table>tbody"); }
	get lyricsDivision () { return this.playlistSection.querySelector("span.lyrics>div"); }


	/**
	 * Handles that activity has changed from false to true.
	 */
	async processActivated () {
		this.messageOutput.value = "";
		console.log(1E-5, 1E+5, Number.MIN_VALUE, Number.MAX_VALUE, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

		// initialize audio system components
		await this.audioMixer.audioWorklet.addModule("../../../tool/audio-processors.js");

		// redefine center content
		while (this.center.lastElementChild) this.center.lastElementChild.remove();
		this.center.append(this.querySectionTemplate.content.firstElementChild.cloneNode(true));

		// register basic event listeners
		this.queryButton.addEventListener("click", event => this.processQueryMatchingTracks());

		this.#periodicallyScheduleTrackPlayback(10);

		try {
			const genresAndArtists = await Promise.all([ this.#invokeQueryAllGenres(), this.#invokeQueryAllArtists() ]);
			for (const genre of genresAndArtists[0])
				this.genreSelector.append(this.constructor.#createOption(genre));
			for (const artist of genresAndArtists[1])
				this.artistSelector.append(this.constructor.#createOption(artist));

			this.messageOutput.value = "";
		} catch (error) {
			this.messageOutput.value = error.toString();
			console.error(error);
		}
	}


	/**
	 * Handles that activity has changed from true to false.
	 */
	processDeactivated () {
		for (const trackSource of this.trackSources) {
			trackSource.stop();
			trackSource.disconnect();
		}

		this.trackSources.length = 0;
		this.#trackPlaylist.length = 0;
	}


	/**
	 * Continuously scans the track playlist asynchronously to perform track playback.
	 * Note that this design defining an asynchronous method performing a loop catching
	 * any errors while active, and subsequently calling setTimeout(), avoids two mayor
	 * pitfalls compared to using setInterval(): No continued scheduling while inactive,
	 * and no overlapping calls of methods running longer than the repetition period!
	 * @param period the repetition period in seconds
	 */
	async #periodicallyScheduleTrackPlayback (period) {
		const activeTrackFaderNodes = [];
		let predecessorStopTime = NaN;

		try {
			while (true) {
				if (this.#trackPlaylist.length > 0 && activeTrackFaderNodes.length < 2) {
					const track = this.#trackPlaylist.shift();
					const trackRecordingContent = await this.#invokeFindAudioRecordingContent(track.recording.identity);
					const trackSource = new AudioBufferSourceNode(this.audioMixer);
					trackSource.buffer = await this.audioMixer.decodeAudioData(trackRecordingContent);
					if (window.isNaN(predecessorStopTime)) predecessorStopTime = this.audioMixer.currentTime;
					if (!this.active) break;

					const companderNode = new AudioWorkletNode(this.audioMixer, "compander-processor");
					this.compressionRatioInput.addEventListener("input", event => companderNode.parameters.get("ratio").setValueAtTime(2 ** parseFloat(event.target.value), 0));
					this.compressionRatioInput.dispatchEvent(new InputEvent("input"));
					trackSource.connect(companderNode);

					activeTrackFaderNodes.unshift(new GainNode(this.audioMixer));
					activeTrackFaderNodes[0].gain.setValueAtTime(activeTrackFaderNodes.length === 2 ? 0 : 1, 0);
					companderNode.connect(activeTrackFaderNodes[0]);

					const masterVolumeNode = new GainNode(this.audioMixer);
					this.masterVolumeInput.addEventListener("input", event => masterVolumeNode.gain.setValueAtTime(parseFloat(event.target.value), 0));
					this.masterVolumeInput.dispatchEvent(new InputEvent("input"));
					activeTrackFaderNodes[0].connect(masterVolumeNode);
					masterVolumeNode.connect(this.audioMixer.destination);

					const crossfadeDuration = Math.min(parseFloat(this.crossfadeDurationInput.value), 0.5 * trackSource.buffer.duration);
					const successorStartTime = Math.max(this.audioMixer.currentTime, predecessorStopTime - crossfadeDuration);
					predecessorStopTime = successorStartTime + trackSource.buffer.duration;
					trackSource.start(successorStartTime);
					trackSource.addEventListener("ended", event => {
						if (this.playlistSection) this.tracksTableBody.firstElementChild.remove();
						this.trackSources.shift();
						activeTrackFaderNodes.pop();
					});

					const durationCell = this.tracksTableBody.querySelector("tr:nth-of-type(" + activeTrackFaderNodes.length + ")>td.duration");
					durationCell.innerText = Math.floor(trackSource.buffer.duration / 60).toString().padStart(2, "0") + ":" + Math.round(trackSource.buffer.duration % 60).toString().padStart(2, "0");
					window.setTimeout(() => this.lyricsDivision.innerHTML = track.lyrics || "", ServerListenerTabController.#SECOND_MILLIES * (successorStartTime - this.audioMixer.currentTime));

					if (activeTrackFaderNodes.length === 2) {
						activeTrackFaderNodes[0].gain.linearRampToValueAtTime(0, successorStartTime);
						activeTrackFaderNodes[1].gain.linearRampToValueAtTime(1, successorStartTime);
						activeTrackFaderNodes[0].gain.linearRampToValueAtTime(1, successorStartTime + crossfadeDuration);
						activeTrackFaderNodes[1].gain.linearRampToValueAtTime(0, successorStartTime + crossfadeDuration);
					}

					this.trackSources.push(trackSource);
					// console.log('track "' + track.title + '" scheduled for time ' + successorStartTime);
				}

				await sleep(period * this.constructor.#SECOND_MILLIES);
				if (!this.active) break;
			}
		} catch (error) {
			this.messageOutput.value = error.toString();
			console.error(error);
		}
	}


	/**
	 * Expands the playlist with tracks matching the selected search criteria.
	 */
	async processQueryMatchingTracks () {
		try {
			const artists = Array.from(this.artistSelector.selectedOptions).map(option => option.value.trim());
			const genres = Array.from(this.genreSelector.selectedOptions).map(option => option.value.trim());
			const tracks = shuffle(await this.#invokeQueryTracks(artists, genres, 50));

			if (!this.playlistSection)
				this.center.append(this.playlistSectionTemplate.content.firstElementChild.cloneNode(true));

			for (const track of tracks) {
				const tableRow = this.playlistTableRowTemplate.content.firstElementChild.cloneNode(true);
				this.tracksTableBody.append(tableRow);

				tableRow.querySelector("td.avatar>img").src = this.sharedProperties["service-origin"] + "/services/documents/" + track.albumCover.identity;
				tableRow.querySelector("td.artist").innerText = track.artist;
				tableRow.querySelector("td.title").innerText = track.title;
				this.#trackPlaylist.push(track);
			}

			for (const track of tracks) {
				if (!track.lyrics && track.genre !== "audiobook") {
					track.lyrics = await this.#invokeQueryLyricsFromRapid(track.artist, track.title);
					if (track.lyrics) await this.#invokeUpdateTrackLyrics(track);
				}
			}

			this.messageOutput.value = "";
		} catch (error) {
			this.messageOutput.value = error.toString();
			console.error(error);
		}
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/tracks/genres - application/json,
	 * and returns a promise for the resulting genres.
	 * @return a promise for the resulting genres
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeQueryAllGenres () {
		const headers = { "Accept": "application/json" };
		const resource = this.sharedProperties["service-origin"] + "/services/tracks/genres";

		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return /* await */ response.json();
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/tracks/artists - application/json,
	 * and returns a promise for the resulting artists.
	 * @return a promise for the resulting artists
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeQueryAllArtists () {
		const headers = { "Accept": "application/json" };
		const resource = this.sharedProperties["service-origin"] + "/services/tracks/artists";

		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return /* await */ response.json();
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/documents/{id} - audio/*,
	 * and returns a promise for the resulting audio recording content.
	 * @return a promise for the audio recording content
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeFindAudioRecordingContent (recordingIdentity) {
		const headers = { "Accept": "audio/*" };
		const resource = this.sharedProperties["service-origin"] + "/services/documents/" + recordingIdentity;

		const response = await fetch(resource, { method: "GET", headers: headers });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return /* await */ response.arrayBuffer();
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/tracks - application/json,
	 * and returns a promise for the resulting tracks.
	 * @param artists the artists
	 * @param genres the genres
	 * @param pagingLimit the (optional) paging limit
	 * @return a promise for the resulting tracks
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeQueryTracks (artists, genres, pagingLimit = 0) {
		const queryParams = new URLSearchParams();
		queryParams.set("has-recording", true);
		for (const artist of artists)
			queryParams.append("artist", artist);
		for (const genre of genres)
			queryParams.append("genre", genre);
		if (pagingLimit > 0)
			queryParams.set("paging-limit", pagingLimit);

		const headers = { "Accept": "application/json" };
		const resource = this.sharedProperties["service-origin"] + "/services/tracks?" + queryParams.toString();

		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return /* await */ response.json();
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * PUT /services/tracks/{id}/lyrics text/plain text/plain,
	 * and returns a promise for the resulting track identity.
	 * @param track the track
	 * @return a promise for the resulting track identity
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeUpdateTrackLyrics (track) {
		const headers = { "Accept": "text/plain", "Content-Type": "text/plain" };
		const resource = this.sharedProperties["service-origin"] + "/services/tracks/" + track.identity;

		const response = await fetch(resource, { method: "PATCH" , headers: headers, body: track.lyrics, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.text());
	}


	/**
	 * Returns the best matching lyrics identity for the given artist and title.
	 * @param artist the artist
	 * @param title the title
	 * @return {Promise} a promise of the best matching lyrics identity, or null for none
	 */
	async #invokeQueryLyricsIdentityFromRapid (artist, title) {
		const queryBuilder = new URLSearchParams();
		queryBuilder.set("q", artist + " " + title);

		const resource = this.constructor.#RAPID_API_ORIGIN + "/search/?" + queryBuilder.toString();
		const headers = { "X-RapidAPI-Key": this.constructor.#RAPID_API_KEY, "X-RapidAPI-Host": this.constructor.#RAPID_API_HOSTNAME };

		const response = await fetch (resource, { method: "GET", headers: headers });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		const data = await response.json();

		for (const hit of data.hits) {
			if (hit.type !== "song") continue;
			if (!hit.result.artist_names.toLowerCase().includes(artist.toLowerCase())) continue;
			if (!hit.result.title.toLowerCase().includes(title.toLowerCase())) continue;
			return hit.result.id;
		}

		return null;
	}


	/**
	 * Returns the lyrics HTML for the given lyrics identity.
	 * @param lyricsIdentity the lyrics identity
	 * @return {Promise} a promise of the lyrics HTML
	 */
	async #invokeQueryLyricsHtmlFromRapid (lyricsIdentity) {
		const resource = this.constructor.#RAPID_API_ORIGIN + "/song/lyrics/?id=" + lyricsIdentity;
		const headers = { "X-RapidAPI-Key": this.constructor.#RAPID_API_KEY, "X-RapidAPI-Host": this.constructor.#RAPID_API_HOSTNAME };

		const response = await fetch (resource, { method: "GET", headers: headers });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		const data = await response.json();

		return data.lyrics.lyrics.body.html;
	}


	/**
	 * Returns the lyrics for the given artist and title.
	 * @param artist the artist
	 * @param title the title
	 * @return {Promise} a promise of the lyrics for the given artist and title, or null for none
	 */
	async #invokeQueryLyricsFromRapid (artist, title) {
		const lyricsIdentity = await this.#invokeQueryLyricsIdentityFromRapid(artist, title);
		if (!lyricsIdentity) return null;

		const lyricsHtml = await this.#invokeQueryLyricsHtmlFromRapid(lyricsIdentity);
		const doc = new DOMParser().parseFromString("<html><body><div>" + lyricsHtml + "</div></body></html>", "text/html");

		const division = doc.querySelector("body>div");
		for (const anchor of division.querySelectorAll("a")) {
			if (anchor.innerHTML.includes("<br>")) {
				const span = doc.createElement("span");
				span.innerHTML = anchor.innerHTML;
				anchor.replaceWith(span);
			} else {
				anchor.replaceWith(anchor.innerText);
			}
		}

		let lyrics = division.innerHTML;
		while (lyrics.includes("<br>")) lyrics = lyrics.replace("<br>", "<br />");

		return lyrics.trim();
	}


	/**
	 * Returns a newly created option element.
	 * @param value the value
	 * @return {HTMLOptionElement} the newly created option element
	 */
	static #createOption (value) {
		const option = document.createElement("option");
		option.value = value;
		option.innerText = value;
		return option;
	}
}


/*
 * Registers an event handler for the browser window's load event.
 */
window.addEventListener("load", event => {
	const controller = new ServerListenerTabController();
	console.log(controller);
});
