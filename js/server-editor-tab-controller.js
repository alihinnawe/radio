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
    constructor() {
        super("server-editor");

        // register controller event listeners 
        this.addEventListener("activated", event => this.processActivated());
    }

    get viewsSectionTemplate() { return document.querySelector("head>template.server-editor"); }
    get viewsSectionSection() { return this.center.querySelector("section.server-editor"); }
    get viewsServerEditorRowTemplate() { return document.querySelector("head>template.server-editor-row"); }
	get viewsServerEditorRowSection() { return this.viewsSectionSection.querySelector("section.server-editor-row"); }
    get editorSectionTemplate() { return document.querySelector("head>template.server-album-editor"); }
    get serverAlbumEditorSection() { return this.center.querySelector("section.server-album-editor"); }
    get editorTrackTemplate() { return document.querySelector("head>template.server-album-editor-row"); }
    get serverAlbumEditorSectionTable() { return this.center.querySelector("section.server-album-editor>div.tracks>div.data>table>tbody"); }

    /**
     * Handles that activity has changed from false to true.
     */
    async processActivated() { // Make this method asynchronous
        const section = this.viewsSectionTemplate.content.firstElementChild.cloneNode(true);
        while (this.center.lastElementChild) this.center.lastElementChild.remove();
        this.center.append(section);

        try {
            // Await the promise to get the resolved array of albums
            const albums_list = await this.#invokeQueryAllAlbums(); // Await the result here
			
        
			for (const album of albums_list){
				console.log("album one is ", album);
				const ServerEditorRowsection = this.viewsServerEditorRowTemplate.content.firstElementChild.cloneNode(true);

                for (let albumTrack of album.trackReferences){
				const singleTrack = this.#invokeGetTrack(albumTrack); 
                // console.log("Künstler Name ist: ",singleTrack);

                const accessButton = ServerEditorRowsection.querySelector("td.access>button");
                const accessButtonImage = ServerEditorRowsection.querySelector("td.access>button>img");

                accessButtonImage.scr = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;
                console.log("accessButtonImage.scr",accessButtonImage.scr);
				accessButton.addEventListener("click", event => console.log("test"));
				// accessButton.querySelector("img").src = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;
				// tableRow.querySelector("td.artist.text").innerText = album.title || "";
				// tableRow.querySelector("td.diet").innerText = DIET[recipe.diet] || "";
				// tableRow.querySelector("td.category").innerText = CATEGORY[recipe.category] || "";
				// tableRow.querySelector("td.ingredient-count").innerText = recipe.ingredientCount.toString();
				// tableRow.querySelector("td.modified").innerText = new Date(recipe.modified).toLocaleDateString();
                this.viewsSectionSection.querySelector("div.albums>div>table>tbody").append(ServerEditorRowsection);
                }
	

				

			}
        } catch (error) {
            console.error("Error fetching albums:", error);
        }

        this.viewsSectionSection.querySelector("div.control>button.create").addEventListener("click", event => this.processDisplayAlbumEditor());
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

    async #invokeCreateOrUpdateAlbum(album) {
        const resource = this.sharedProperties["service-origin"] + "/services/albums";
        const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
        const response = await fetch(resource, { method: "POST", headers: headers, body: JSON.stringify(album), credentials: "include" });
        if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
        return window.parseInt(await response.json());
    }

    async #invokeQueryAllAlbums() {
        const resource = this.sharedProperties["service-origin"] + "/services/albums";
        const headers = { "Accept": "application/json" };
        const response = await fetch(resource, { method: "GET", headers: headers, credentials: "include" });

        if (!response.ok) {
            throw new Error("HTTP " + response.status + " " + response.statusText);
        }

        const albums = await response.json();
        return albums; 
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
        this.serverAlbumEditorSectionTable.innerHTML = ""; 
        // Clone the track template for a new track
        const trackTemplate = this.editorTrackTemplate.content.firstElementChild.cloneNode(true);
        this.serverAlbumEditorSectionTable.append(trackTemplate); // Add the new track row to the table
    
        // Get the submit button for the newly added track row
        const actionSubmit = trackTemplate.querySelector("td.action>button.submit");
    
        // Attach event listener for the submit button in the new track row
        actionSubmit.addEventListener("click", async (event) => {
            try {
                // Get values from the current track row's input fields
                const ordinal = window.parseInt(trackTemplate.querySelector("td.ordinal>input").value || "0");
                const artist = trackTemplate.querySelector("td.artist>input").value || "";
                const title = trackTemplate.querySelector("td.title>input").value || "";
                const genre = trackTemplate.querySelector("td.genre>input").value || "";
    
                // Prepare track data
                this.#track = { ordinal, artist, title, genre };
                console.log("Track Data:", this.#track);
    
                // Save track to the server
                const resultTrack = await this.#invokeSaveTrack(albumIdentity, this.#track);
                console.log("Saved Track:", resultTrack);
    
                // Optionally clear input fields after saving if needed
                trackTemplate.querySelector("td.ordinal>input").value = "";
                trackTemplate.querySelector("td.artist>input").value = "";
                trackTemplate.querySelector("td.title>input").value = "";
                trackTemplate.querySelector("td.genre>input").value = "";
            } catch (error) {
                console.error("Error saving track:", error);
            }
        });
    }

    async #invokeGetTrack(albumTrackNumber){
        const resource = this.sharedProperties["service-origin"] + "/services/tracks/"  +  albumTrackNumber;
        const headers = { "Accept": "application/json" };
        const response = await fetch(resource, { method: "GET", headers: headers, credentials: "include" });

        if (!response.ok) {
            throw new Error("HTTP " + response.status + " " + response.statusText);
        }

        const tracks = await response.json();
        return tracks; 
    }

    async #invokeSaveTrack(albumIdentity, track) {
        const resource = this.sharedProperties["service-origin"] + "/services/albums/" + albumIdentity + "/tracks";
        const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
        const response = await fetch(resource, { method: "POST", headers: headers, body: JSON.stringify(track), credentials: "include" });
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
