import TabController from "../../../tool/tab-controller.js";


/**
 * Server editor tab controller type.
 */
class ServerEditorTabController extends TabController {

	/**
	 * Initializes a new instance.
	 */
	constructor () {
		super("server-editor");

		// register controller event listeners 
		this.addEventListener("activated", event => this.processActivated());
	}


	// HTML element getter operations
	get viewsSectionTemplate () { return document.querySelector("head>template.server-editor"); }
	get viewsTableRowTemplate () { return document.querySelector("head>template.server-editor-row"); }
	get viewsSection () { return this.center.querySelector("section.server-editor"); }
	get viewsTableBody () { return this.viewsSection.querySelector("div.albums>div>table>tbody"); }
	get viewsCreateButton () { return this.viewsSection.querySelector("div.control>button.create"); }

	get editorSectionTemplate () { return document.querySelector("head>template.server-album-editor"); }
	get editorTableRowTemplate () { return document.querySelector("head>template.server-album-editor-row"); }
	get editorSection () { return this.center.querySelector("section.server-album-editor"); }
	get editorAlbumDivision () { return this.editorSection.querySelector("div.album"); }
	get editorCoverButton () { return this.editorAlbumDivision.querySelector("span.cover>button"); }
	get editorCoverViewer () { return this.editorCoverButton.querySelector("img"); }
	get editorCoverChooser () { return this.editorAlbumDivision.querySelector("span.cover>input"); }
	get editorTitleInput () { return this.editorAlbumDivision.querySelector("span.other>div.title>input"); }
	get editorReleaseYearInput () { return this.editorAlbumDivision.querySelector("span.other>div.release-year>input"); }
	get editorTrackCountInput () { return this.editorAlbumDivision.querySelector("span.other>div.track-count>input"); }
	get editorTracksDivision () { return this.editorSection.querySelector("div.tracks"); }
	get editorTracksTableBody () { return this.editorTracksDivision.querySelector("table>tbody"); }
	get editorTracksCreateButton () { return this.editorTracksDivision.querySelector("div.control>button.create"); }

	get editorSubmitButton () { return this.editorSection.querySelector("div.control>button.submit"); }
	get editorDeleteButton () { return this.editorSection.querySelector("div.control>button.delete"); }
	get editorCancelButton () { return this.editorSection.querySelector("div.control>button.cancel"); }


	/**
	 * Handles that activity has changed from false to true.
	 */
	async processActivated () {
		const audioContext = this.sharedProperties["audio-context"];
		const masterVolume = this.sharedProperties["master-volume"];
		this.messageOutput.value = "";

		// redefine center content
		while (this.center.lastElementChild) this.center.lastElementChild.remove();
		this.center.append(this.viewsSectionTemplate.content.firstElementChild.cloneNode(true));

		// register basic event listeners
		this.viewsCreateButton.addEventListener("click", event => this.processDisplayAlbumEditor());

		this.#displayAllAlbums();
	}


	/**
	 * Displays all persistent albums.
	 */
	async #displayAllAlbums () {
		try {
			const albums = await this.#invokeQueryAllAlbums();
			// console.log(albums);

			this.viewsTableBody.innerHTML = "";
			for (const album of albums) {
				const tableRow = this.viewsTableRowTemplate.content.firstElementChild.cloneNode(true);
				this.viewsTableBody.append(tableRow);

				const accessButton = tableRow.querySelector("td.access>button");
				accessButton.addEventListener("click", event => this.processDisplayAlbumEditor(album));
				accessButton.querySelector("img").src = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;
				tableRow.querySelector("td.artist").innerText = album.artist || "-";
				tableRow.querySelector("td.title").innerText = album.title || "-";
				tableRow.querySelector("td.genre").innerText = album.genre || "-";
				tableRow.querySelector("td.release-year").innerText = album.releaseYear.toString();
				tableRow.querySelector("td.track-count").innerText = album.trackReferences.length + "/" + album.trackCount;
			}

			this.messageOutput.value = "";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Displays the given album in a new editor section.
	 * @param album the album, or a new object for none
	 */
	async processDisplayAlbumEditor (album = {}) {
		try {
			const sessionOwner = this.sharedProperties["session-owner"];
			if (!album.authorReference) album.authorReference = sessionOwner.identity;
			if (!album.cover) album.cover = { identity: 1 };

			this.viewsSection.classList.add("hidden");
			if (!this.editorSection)
				this.center.append(this.editorSectionTemplate.content.firstElementChild.cloneNode(true));

			this.editorCoverViewer.src = this.sharedProperties["service-origin"] + "/services/documents/" + (album.cover.identity || 1);
			this.editorTitleInput.value = album.title || "";
			this.editorReleaseYearInput.value = (album.releaseYear || new Date().getFullYear()).toString();
			this.editorTrackCountInput.value = (album.trackCount || 0).toString();

			this.editorCancelButton.addEventListener("click", event => this.processCancel());
			this.editorTracksCreateButton.addEventListener("click", event => this.processDisplayTrackEditor(album));

			if (album.authorReference === sessionOwner.identity || sessionOwner.group === "ADMIN") {
				this.editorCoverButton.addEventListener("click", event => this.editorCoverChooser.click());
				this.editorCoverViewer.addEventListener("dragover", event => this.validateImageTransfer(event.dataTransfer));
				this.editorCoverViewer.addEventListener("drop", event => this.processSubmitAlbumCover(album, event.dataTransfer.files[0]));
				this.editorCoverChooser.addEventListener("change", event => this.processSubmitAlbumCover(album, event.target.files[0]));
				this.editorSubmitButton.addEventListener("click", event => this.processSubmitAlbum(album));
				this.editorDeleteButton.addEventListener("click", event => this.processDeleteAlbum(album));
			} else {
				this.editorCoverButton.disabled = true;
				this.editorSubmitButton.disabled = true;
				this.editorDeleteButton.disabled = true;
			}

			if (album.identity) {
				const tracks = await this.#invokeQueryAlbumTracks(album);
				for (const track of tracks) this.processDisplayTrackEditor(album, track);
			} else {
				this.editorTracksDivision.classList.add("hidden");
			}

			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Performs validating an image transfer attempt.
	 * @param dataTransfer the image transfer
	 */
	async validateImageTransfer (dataTransfer) {
		const primaryItem = dataTransfer.items[0];
		dataTransfer.dropEffect = primaryItem.kind === "file" && primaryItem.type && primaryItem.type.startsWith("image/") ? "copy" : "none";
	}


	/**
	 * Performs submitting the album cover.
	 * @param album the album
	 * @param coverFile the cover image file
	 */
	async processSubmitAlbumCover (album, coverFile) {
		try {
			album.cover.identity = await this.#invokeInsertOrUpdateDocument(coverFile);
			this.editorCoverViewer.src = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;

			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Submits the given album.
	 * @param album the album
	 */
	async processSubmitAlbum (album) {
		try {
			album.title = this.editorTitleInput.value.trim() || null;
			album.releaseYear = window.parseInt(this.editorReleaseYearInput.value) || new Date().getFullYear();
			album.trackCount =  window.parseInt(this.editorTrackCountInput.value) || 0;

			album.identity = await this.#invokeInsertOrUpdateAlbum(album);
			album.version = (album.version || 0) + 1;

			this.editorTracksDivision.classList.remove("hidden");
			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Deletes the given album.
	 * @param album the album
	 */
	async processDeleteAlbum (album) {
		try {
			if (album.identity) await this.#invokeDeleteAlbum(album);
			this.messageOutput.value = "ok.";
			this.editorCancelButton.click();
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Displays the table row editor for the given track of the given album.
	 * @param album the album
	 * @param track the track, or a new object for none
	 */
	async processDisplayTrackEditor (album, track = {}) {
		try {
			const sessionOwner = this.sharedProperties["session-owner"];
			if (!track.authorReference) track.authorReference = sessionOwner.identity;

			const tableRow = this.editorTableRowTemplate.content.firstElementChild.cloneNode(true);
			this.editorTracksTableBody.append(tableRow);

			const ordinalInput = tableRow.querySelector("td.ordinal>input");
			ordinalInput.value = ((track.ordinal || 0) + 1).toString();
			ordinalInput.disabled = !!track.identity;

			const artistInput = tableRow.querySelector("td.artist>input");
			artistInput.value = track.artist || "";

			const titleInput = tableRow.querySelector("td.title>input");
			titleInput.value = track.title || "";

			const genreInput = tableRow.querySelector("td.genre>input");
			genreInput.value = track.genre || "";
	
			const recordingChooser = tableRow.querySelector("td.recording>input");
			recordingChooser.addEventListener("change", event => this.processSubmitTrackRecording(track, event.target.files[0], tableRow));

			const recordingButton = tableRow.querySelector("td.recording>button");
			recordingButton.addEventListener("click", event => recordingChooser.click());
			if (track.recording) recordingButton.innerText = track.recording.description || track.recording.type;

			const submitButton = tableRow.querySelector("td.action>button.submit");
			submitButton.addEventListener("click", event => this.processSubmitTrack(album, track, tableRow));

			const removeButton = tableRow.querySelector("td.action>button.remove");
			removeButton.addEventListener("click", event => this.processDeleteTrack(album, track, tableRow));
			removeButton.disabled = !track.identity;

			if (track.authorReference !== sessionOwner.identity && sessionOwner.group !== "ADMIN") {
				ordinalInput.disabled = true;
				artistInput.disabled = true;
				titleInput.disabled = true;
				genreInput.disabled = true;
				recordingButton.disabled = true;
				submitButton.disabled = true;
				removeButton.disabled = true;
			}
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Performs submitting the album track recording.
	 * @param track the album track
	 * @param recordingFile the recording audio file
	 * @param tableRow the table row element
	 */
	async processSubmitTrackRecording (track, recordingFile, tableRow) {
		try {
			const recordingIdentity = await this.#invokeInsertOrUpdateDocument(recordingFile);
			if (!track.recording) track.recording = {};
			track.recording.identity = recordingIdentity;
			tableRow.querySelector("td.recording>button").innerText = recordingFile.name;

			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Submits the given album track.
	 * @param album the album
	 * @param track the track
	 * @param tableRow the table row element
	 */
	async processSubmitTrack (album, track, tableRow) {
		try {
			track.ordinal = window.parseInt(tableRow.querySelector("td.ordinal>input").value) - 1;
			track.artist = tableRow.querySelector("td.artist>input").value.trim() || null;
			track.title = tableRow.querySelector("td.title>input").value.trim() || null;
			track.genre = tableRow.querySelector("td.genre>input").value.trim() || null;

			track.identity = await this.#invokeInsertOrUpdateTrack(album, track);
			track.version = (track.version || 0) + 1;

			tableRow.querySelector("td.ordinal>input").disabled = true;
			tableRow.querySelector("td.action>button.remove").disabled = false;
			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Removes the given album track.
	 * @param album the album
	 * @param track the track
	 * @param tableRow the table row element
	 */
	async processDeleteTrack (album, track, tableRow) {
		try {
			if (track.identity)
				await this.#invokeDeleteTrack(album, track);

			tableRow.remove();
			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Removes the editor section and re-displays the refreshed table section.
	 */
	async processCancel () {
		this.editorSection.remove();
		await this.#displayAllAlbums();
		this.viewsSection.classList.remove("hidden");
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/albums - application/json,
	 * and returns a promise for the resulting albums.
	 * @return a promise for the resulting albums
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeQueryAllAlbums () {
		const resource = this.sharedProperties["service-origin"] + "/services/albums";
		const headers = { "Accept": "application/json" };

		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return /* await */ response.json();
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/albums/{id}/tracks - application/json,
	 * and returns a promise for the resulting album tracks.
	 * @param album the album
	 * @return a promise for the resulting album tracks
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeQueryAlbumTracks (album) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums/" + album.identity + "/tracks";
		const headers = { "Accept": "application/json" };

		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return /* await */ response.json();
	}



	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * POST /services/albums application/json text/plain,
	 * and returns a promise for the identity of the modified album.
	 * @param album the album
	 * @return a promise for the identity of the modified album
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeInsertOrUpdateAlbum (album) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums";
		const headers = { "Accept": "text/plain", "Content-Type": "application/json" };

		const response = await fetch(resource, { method: "POST" , headers: headers, body: JSON.stringify(album), credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.text());
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * DELETE /services/albums/{id} - text/plain,
	 * and returns a promise for the identity of the deleted album.
	 * @param album the album
	 * @return a promise for the identity of the deleted album
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeDeleteAlbum (album) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums/" + album.identity;
		const headers = { "Accept": "text/plain" };

		const response = await fetch(resource, { method: "DELETE" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.text());
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * POST /services/albums/{id}/tracks application/json text/plain,
	 * and returns a promise for the identity of the modified track.
	 * @param album the album
	 * @param track the track
	 * @return a promise for the identity of the modified track
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeInsertOrUpdateTrack (album, track) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums/" + album.identity + "/tracks";
		const headers = { "Accept": "text/plain", "Content-Type": "application/json" };

		const response = await fetch(resource, { method: "POST" , headers: headers, body: JSON.stringify(track), credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.text());
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * DELETE /services/albums/{id1}/tracks/{id2} - text/plain,
	 * and returns a promise for the identity of the deleted recipe.
	 * @param recipe the recipe
	 * @return a promise for the identity of the deleted recipe
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeDeleteTrack (album, track) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums/" + album.identity + "/tracks/" + track.identity;
		const headers = { "Accept": "text/plain" };

		const response = await fetch(resource, { method: "DELETE" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.text());
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * POST /services/documents * text/plain,
	 * and returns a promise for the resulting document's identity.
	 * @param file the file
	 * @return a promise for the resulting document's identity
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeInsertOrUpdateDocument (file) {
		const headers = { "Accept": "text/plain", "Content-Type": file.type, "X-Content-Description": file.name };
		const resource = this.sharedProperties["service-origin"] + "/services/documents";

		const response = await fetch(resource, { method: "POST" , headers: headers, body: file, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.text());
	}
}


/*
 * Registers an event handler for the browser window's load event.
 */
window.addEventListener("load", event => {
	const controller = new ServerEditorTabController();
	console.log(controller);
});
