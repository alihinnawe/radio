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
        this.#album = null;
        this.#track = null;
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
    get editorTrackSection() { return document.querySelector("head>template.server-album-editor-row"); }
    get serverAlbumEditorSectionTable() { return this.center.querySelector("section.server-album-editor>div.tracks>div.data>table>tbody"); }

    get avatarAlbumButton () { return this.serverAlbumEditorSection.querySelector("div.album>span.cover>button"); }
	get avatarAlbumViewer () { return this.avatarAlbumButton.querySelector("div.album>span.cover>button>img"); }
	get avatarAlbumChooser () { return this.serverAlbumEditorSection.querySelector("div.album>span.cover>input"); }
    
    /**
     * Handles that activity has changed from false to true.
     */
    async processActivated() { // Make this method asynchronous
        const section = this.viewsSectionTemplate.content.firstElementChild.cloneNode(true);
        while (this.center.lastElementChild) this.center.lastElementChild.remove();
        this.center.append(section);


        try {     

                    // Immediately save the album
            const albums_list = await this.#invokeQueryAllAlbums(); // invoke all albums
            console.log("query all albums", albums_list);

            // Await the promise to get the resolved array of albums
			// to do only on add event listener we call the tracks.
			for (const album of albums_list){
				// console.log("album one is ", album);
                this.#invokeAlbum(album);	
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

		// save album into database
        const albumIdentity = await this.#invokeSaveAlbum();
        const GetSavedAlbum = await this.#getAlbumByIdentity(albumIdentity);
        this.avatarAlbumViewer.addEventListener("dragover", event => this.validateAvatarTransfer(event.dataTransfer));
		this.avatarAlbumViewer.addEventListener("drop", event => this.processSubmitAlbumAvatar(GetSavedAlbum, event.dataTransfer.files[0]));
        
        // Now allow track creation
        const buttonTrack = this.serverAlbumEditorSection.querySelector("div.tracks>div.control>button.create");
        buttonTrack.addEventListener("click", () => this.#invokeCreateOrUpdateTrack(albumIdentity));
    }


    // only for save
    async #invokeCreateOrUpdateAlbum(album) {
        console.log("Updating album:", JSON.stringify(album));
        const resource = this.sharedProperties["service-origin"] + "/services/albums";
        const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
    
        const response = await fetch(resource, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(album),
            credentials: "include"
        });
    
        if (!response.ok) {
            const errorResponse = await response.text(); // Get additional error info
            throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${errorResponse}`);
        }
    
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


    // it invokes the album header for editing
    async #invokeQueryAlbum(album) {
        this.viewsSectionSection.classList.add("hidden");
        const albumTemplate = this.editorSectionTemplate.content.firstElementChild.cloneNode(true);
        this.center.append(albumTemplate);

        const accessSaveButton = this.serverAlbumEditorSection.querySelector("div.control>button.submit");
        this.viewsSectionSection.querySelector("div.albums>div>table>tbody").append(this.ServerEditorRowsection);

        accessSaveButton.addEventListener("click",event => this.#invokeUpdateAlbum(album.identity));

        this.serverAlbumEditorSection.querySelector("div.album>span.cover>button>img").addEventListener("dragover", event => this.validateAvatarTransfer(event.dataTransfer));

        const accessButtonImage = this.serverAlbumEditorSection.querySelector("div.album>span.cover>button>img");
        accessButtonImage.src = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;
        // console.log("accessButtonImage.srcaccessButtonImage.src",accessButtonImage.src);


        // Get the updated values of the inputs when the save button is clicked
        const title = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.title>input");
        title.value = album.title.trim() || "";

        const releaseYear = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.release-year>input");
        releaseYear.value = parseInt(album.releaseYear || "null");

        const trackCount = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.track-count>input");
        trackCount.value = parseInt(album.trackCount || "0");

        // invoke tracks for each album when clicking on the album
        this.#invokeQuerySingleTrack(album);
        // console.log("track lists are: ",tracks_list);
    }

    // invoke each album row in the albums table
    async #invokeAlbum(album){
        // console.log("newwwwwwwwww ALbum track",album);
    
            const ServerEditorRowsection = this.viewsServerEditorRowTemplate.content.firstElementChild.cloneNode(true);
            console.log("ServerEditorRowsectionServerEditorRowsectionServerEditorRowsection",ServerEditorRowsection);
            // get the artist for each
            // const singleTrack = await this.#invokeGetTrack(album.trackReferences[0]); 
            // console.log("Single track Object Name ist: ",singleTrack);

            const accessButton = ServerEditorRowsection.querySelector("td.access>button");
            const accessButtonImage = ServerEditorRowsection.querySelector("td.access>button>img");

            accessButtonImage.src = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;
            console.log("accessButtonImage.srcaccessButtonImage.src",accessButtonImage.src);
            const artist = ServerEditorRowsection.querySelector("td.artist.text");
            artist.innerText = album.artist || "various artist";

            // artist.innerText =  "vio";

            const title = ServerEditorRowsection.querySelector("td.title.text");
            title.innerText = album.title || "";

            const genre = ServerEditorRowsection.querySelector("td.genre.text");
            genre.innerText = album.genre || "various genre";

            const year = ServerEditorRowsection.querySelector("td.release-year.number");
            year.innerText= parseInt(album.releaseYear || "0");

            const tracks = ServerEditorRowsection.querySelector("td.track-count.number");
            tracks.innerText = `${parseInt(album.trackReferences.length|| "0") + "/" + album.trackCount}`;

            // const trackSection = this.serverAlbumEditorSection.append();
            this.viewsSectionSection.querySelector("div.albums>div>table>tbody").append(ServerEditorRowsection);

            accessButton.addEventListener("click", event => this.#invokeQueryAlbum(album));


            


    };


// only for saving new track directly after creating new album
 
    async #invokeQuerySingleTrack(album) {
        // Fetch or call each track reference number in the album 
        for (let trackIdReference of album.trackReferences) {
            const ServerEditorTrackTemplate = this.editorTrackTemplate.content.firstElementChild.cloneNode(true);
            const singleTrack = await this.#invokeGetTrack(trackIdReference); 
            
            const ordinal = ServerEditorTrackTemplate.querySelector("tr>td.ordinal>input");
            ordinal.value = singleTrack.ordinal || null;
            
            const artist = ServerEditorTrackTemplate.querySelector("tr>td.artist>input");
            artist.value = singleTrack.artist || "";
            
            const title = ServerEditorTrackTemplate.querySelector("tr>td.title>input");
            title.value = singleTrack.title || "";
            
            const genre = ServerEditorTrackTemplate.querySelector("tr>td.genre>input");
            genre.value = singleTrack.genre || "";

            const serverAlbumEditorTableNew = this.serverAlbumEditorSection.querySelector("div.tracks>div.data>table>tbody");
            serverAlbumEditorTableNew.append(ServerEditorTrackTemplate); 

            const accessTrackNewButton = ServerEditorTrackTemplate.querySelector("tr>td.action>button.submit");
            accessTrackNewButton.addEventListener("click", async event => {

                const updatedTrackData = {
                    trackId: trackIdReference, 
                    ordinal: ordinal.value, 
                    artist: artist.value, 
                    title: title.value, 
                    genre: genre.value 
                };

                await this.#invokeUpdateTrack(album.identity, updatedTrackData); 
            });        
        }
    }


    async #invokeCreateOrUpdateTrack(albumIdentity) {
        this.serverAlbumEditorSectionTable.innerHTML = ""; 

        // Clone the track template for a new track
        const trackTemplate = this.editorTrackTemplate.content.firstElementChild.cloneNode(true);
        this.serverAlbumEditorSectionTable.append(trackTemplate); // Add the new track row to the table
    
        // Get the submit button for the newly added track row
        const actionSubmit = trackTemplate.querySelector("tr>td.action>button.submit");
    
        // Attach event listener for the submit button in the new track row
        actionSubmit.addEventListener("click", async (event) => {
            try {
                // Get values from the current track row's input fields
                const ordinal = window.parseInt(this.serverAlbumEditorSectionTable.querySelector("tr>td.ordinal>input").value || "0");
                const artist = this.serverAlbumEditorSectionTable.querySelector("tr>td.artist>input").value || "";
                const title = this.serverAlbumEditorSectionTable.querySelector("tr>td.title>input").value || "";
                const genre = this.serverAlbumEditorSectionTable.querySelector("tr>td.genre>input").value || "";
    
                // Prepare track data
                this.#track = { ordinal, artist, title, genre };
                // console.log("Track Data:", this.#track);
    
                // Save track to the server
                const resultTrack = await this.#invokeSaveTrack(albumIdentity, this.#track);
                console.log("Saved Track final:", resultTrack);
                
                // Optionally clear input fields after saving if needed
                trackTemplate.querySelector("td.ordinal>input").value = 1;
                trackTemplate.querySelector("td.artist>input").value = "";
                trackTemplate.querySelector("td.title>input").value = "";
                trackTemplate.querySelector("td.genre>input").value = "";
            
            } catch (error) {
                console.error("Error saving track:", error);
            }
        });
    }


    async #invokeUpdateTrack(albumIdentity, updatedTrack) {
            console.log("trackIdentitytrackIdentitytrackIdentity",updatedTrack.trackId);
            try {

                // Fetch the current album data
                const currentTrack = await this.#invokeGetTrack(updatedTrack.trackId);
                console.log("current track",currentTrack);
                
                if (!currentTrack || !currentTrack.identity || currentTrack.version === undefined) {
                throw new Error("Album not found or invalid data.");
                }
            
                // this is the the updated album object
                const updatedTrackFinal = {
                    ...currentTrack,
                    ordinal: updatedTrack.ordinal,
                    artist: updatedTrack.artist,
                    title: updatedTrack.title,
                    genre: updatedTrack.genre };

                console.log("updated tarck: ", updatedTrackFinal)
                
                // Save track to the server
                const resultTrack = await this.#invokeSaveUpdatedTrack(albumIdentity,updatedTrackFinal);
                currentTrack.version = (currentTrack.version || 0) + 1;
                
            } catch (error) {
                console.error("Error saving track:", error);
            }

    }


    async #invokeGetTrack(trackNumber){
        const resource = this.sharedProperties["service-origin"] + "/services/tracks/"  +  trackNumber;
        const headers = { "Accept": "application/json" };
        const response = await fetch(resource, { method: "GET", headers: headers, credentials: "include" });

        if (!response.ok) {
            throw new Error("HTTP " + response.status + " " + response.statusText);
        }
        return await response.json();
    }


    async #invokeSaveTrack(albumIdentity, track) {
        const resource = this.sharedProperties["service-origin"] + "/services/albums/" + albumIdentity + "/tracks";
        const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
        const response = await fetch(resource, { method: "POST", headers: headers, body: JSON.stringify(track), credentials: "include" });
        if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
        return window.parseInt(await response.json());
    }


    async #invokeSaveUpdatedTrack(albumIdentity,trackIdentityUpdated) {
        console.log("track identity updated", trackIdentityUpdated);
        const resource = this.sharedProperties["service-origin"] + "/services/albums/" + albumIdentity + "/tracks" ;
        console.log("resource",resource);
        const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
        const response = await fetch(resource, { method: "POST", headers: headers, body: JSON.stringify(trackIdentityUpdated), credentials: "include" });
        console.log("track respones is",response);
        if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
        return window.parseInt(await response.json());
    }


    async #getAlbumByIdentity(identity) {
        const resource = `${this.sharedProperties["service-origin"]}/services/albums/${identity}`;
        const response = await fetch(resource, { method: "GET", credentials: "include" });
        if (!response.ok) {
            throw new Error("Failed to fetch album: " + response.statusText);
        }
        return await response.json();
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
                    // console.log(result);
                    resolve(result);     
                } catch (error) {
                    console.error("Error updating the album:", error);
                    reject(error);     
                }
            }, { once: true });  // Ensure the event listener is executed only once
        });
    }


    async #invokeUpdateAlbum(identity) {
        try {
            // Fetch the current album data
            const currentAlbum = await this.#getAlbumByIdentity(identity);
            
            // Ensure the identity and current version are valid
            if (!currentAlbum || !currentAlbum.identity || currentAlbum.version === undefined) {
                throw new Error("Album not found or invalid data.");
            }
    
            // Increment the version
    
            // Get updated values from the input fields
            const title = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.title>input").value.trim();
            const releaseYear = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.release-year>input").value.trim();
            const trackCount = this.serverAlbumEditorSection.querySelector("div.album>span.other>div.track-count>input").value.trim();

            // Prepare the updated album object
            const updatedAlbum = {
                ...currentAlbum,
                title,
                releaseYear,
                trackCount,
            };

            // Call the function to create or update the album
            const result = await this.#invokeCreateOrUpdateAlbum(updatedAlbum);
            currentAlbum.version = (currentAlbum.version || 0) + 1;
            console.log("Album updated successfully:", result);
            return result;
        } catch (error) {
            console.error("Error updating the album:", error);
            throw error; // Rethrow error for further handling if needed
        }
    }


    async validateAvatarTransfer (dataTransfer) {
		const primaryItem = dataTransfer.items[0];
		dataTransfer.dropEffect = primaryItem.kind === "file" && primaryItem.type && primaryItem.type.startsWith("image/") ? "copy" : "none";
	}

	async processSubmitAlbumAvatar (album, avatarFile) {
		try {
			album.cover.identity = await this.#invokeInsertOrUpdateDocument(avatarFile);
            album.cover.description = avatarFile.name;
            const result = await this.#invokeCreateOrUpdateAlbum(album);
			this.avatarAlbumViewer.src = this.sharedProperties["service-origin"] + "/services/documents/" + album.cover.identity;

			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}
   
    
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
    const controller = new EditorTabController();
    console.log(controller);
});