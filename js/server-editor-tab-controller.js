import TabController from "../../../tool/tab-controller.js";


/**
 * Skeleton for tab controller type.
 */
class EditorTabController extends TabController {
	#album;
	#track;
	/**
	 * Initializes a new instance.
	 */
	constructor () {
		super("server-editor");

		// register controller event listeners 
		this.addEventListener("activated", event => this.processActivated());

		// this.addEventListener("deactivated", event => this.processDeactivated());
	}

	get viewsSectionTemplate () { return document.querySelector("head>template.server-editor"); }
	get viewsSectionSection () { return document.querySelector("section.server-editor"); }

	get editorSectionTemplate () { return document.querySelector("head>template.server-album-editor"); }
	get serverAlbumEditorSection () { return this.center.querySelector("section.server-album-editor"); }
	get editorTrackTemplate () { return document.querySelector("head>template.server-album-editor-row"); }
	get serverAlbumEditorSectionTable () { return this.center.querySelector("section.server-album-editor>div.tracks>div.data>table>tbody"); }


	/**
	 * Handles that activity has changed from false to true.
	 */
	processActivated () {
		const section = this.viewsSectionTemplate.content.firstElementChild.cloneNode(true);
		while (this.center.lastElementChild) this.center.lastElementChild.remove();
		this.center.append(section);

		this.viewsSectionSection.querySelector("div.control>button.create").addEventListener("click",event => this.processDisplayAlbumEditor());

	     //const albums = this.#invokeQueryAllAlbums();
		//console.log("albums",albums)



		// register basic event listeners
	}


	async processDisplayAlbumEditor() {
		const sessionOwner = this.sharedProperties["session-owner"];
		this.viewsSectionSection.classList.add("hidden");
	
		// Clone editor section template
		const tableRow = this.editorSectionTemplate.content.firstElementChild.cloneNode(true);
		this.center.append(tableRow);
	
		// Set cover image source
		const imageCoverSource = this.sharedProperties["service-origin"] + "/services/documents/" + sessionOwner.avatar.identity;
		const imageCoverAvatar = tableRow.querySelector("div.album>span.cover>button>img");
		imageCoverAvatar.src = imageCoverSource;
	
		// Immediately save the album
		const albumIdentity = await this.#invokeSaveAlbum();
		console.log("albumIdentity", albumIdentity);
	
		// Now allow track creation
		const buttonTrack = this.serverAlbumEditorSection.querySelector("div.tracks>div.control>button.create");
		buttonTrack.addEventListener("click", () => this.#invokeCreateOrUpdateTrack(albumIdentity));
	}
	
	


	async #invokeCreateOrUpdateAlbum (album) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums";
		const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
		const response = await fetch(resource, { method: "POST" , headers: headers, body: JSON.stringify(album), credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.json());
	}

	
	async #invokeQueryAllAlbums () {
		const resource = this.sharedProperties["service-origin"] + "/services/albums";
		const headers = { "Accept": "application/json" };
		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return response.json();
	}

	async #invokeSaveAlbum() {
		// Add event listener for the save button
		const speichernButton = this.serverAlbumEditorSection.querySelector("div.control>button.submit");
		return new Promise((resolve, reject) => {
			speichernButton.addEventListener("click", async event => {
				try {
					// Get the updated values of the inputs when the save button is clicked
					const title = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.title>input").value.trim();
					const releaseYear = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.release-year>input").value.trim();
					const trackCount = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.track-count>input").value.trim();
	
					// Update the album object with the latest input values
					this.#album = { title, releaseYear, trackCount };
	
					// Call the function to create or update the album
					const result = await this.#invokeCreateOrUpdateAlbum(this.#album);
					console.log(result); 
					resolve(result);     
				} catch (error) {
					console.error("Error updating the album:", error);
					reject(error);     
				}
			}, { once: true });  // Ensure the event listener is executed only once
		});
	}


	async #invokeCreateOrUpdateTrack(albumIdentity) {
		const trackTemplate = this.editorTrackTemplate.content.firstElementChild.cloneNode(true);
		this.serverAlbumEditorSectionTable.append(trackTemplate);
	
		const actionSubmit = this.serverAlbumEditorSectionTable.querySelector("tr>td.action>button.submit");
		actionSubmit.addEventListener("click", async event => {
			try {
				const ordinal = window.parseInt(this.serverAlbumEditorSectionTable.querySelector("tr>td.ordinal>input").value || "0");
				const artist = this.serverAlbumEditorSectionTable.querySelector("tr>td.artist>input").value || "";
				const title = this.serverAlbumEditorSectionTable.querySelector("tr>td.title>input").value || "";
				const genre = this.serverAlbumEditorSectionTable.querySelector("tr>td.genre>input").value || "";
	
				// Prepare track data
				this.#track = { ordinal, artist, title, genre };
				console.log("Track Data:", this.#track);
	
				// Save track
				const resultTrack = await this.#invokeSaveTrack(albumIdentity, this.#track);
				console.log("Saved Track:", resultTrack);
			} catch (error) {
				console.error("Error saving track:", error);
			}
		}, { once: true });
	}
	
			
			//this.#invokeSaveTrack(albumIdentity))



	async #invokeSaveTrack(albumIdentity,track) {
		//console.log("albumIdentity,trac",albumIdentity,track);
		const resource = this.sharedProperties["service-origin"] + "/services/albums/" + albumIdentity + "/tracks";
		console.log("resourrrrrce",resource);
		const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
		const response = await fetch(resource, { method: "POST" , headers: headers, body: JSON.stringify(track), credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return window.parseInt(await response.json());
	}
}



/*
 * Registers an event handler for the browser window's load event.
 */
window.addEventListener("load", event => {
	const controller = new EditorTabController();
	console.log(controller);
});