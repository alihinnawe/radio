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
    this.addEventListener("activated", (event) => this.processActivated());
  }

  get viewsSectionTemplate() {
    return document.querySelector("head>template.server-editor");
  }
  get viewsSectionSection() {
    return this.center.querySelector("section.server-editor");
  }
  get viewsServerEditorRowTemplate() {
    return document.querySelector("head>template.server-editor-row");
  }
  get viewsServerEditorRowSection() {
    return this.viewsSectionSection.querySelector("section.server-editor-row");
  }
  get editorSectionTemplate() {
    return document.querySelector("head>template.server-album-editor");
  }
  get serverAlbumEditorSection() {
    return this.center.querySelector("section.server-album-editor");
  }
  get editorTrackTemplate() {
    return document.querySelector("head>template.server-album-editor-row");
  }
  get serverAlbumEditorSectionTable() {
    return this.center.querySelector(
      "section.server-album-editor>div.tracks>div.data>table>tbody"
    );
  }

  get avatarAlbumButton() {
    return this.serverAlbumEditorSection.querySelector(
      "div.album>span.cover>button"
    );
  }
  get avatarAlbumViewer() {
    return this.avatarAlbumButton.querySelector(
      "div.album>span.cover>button>img"
    );
  }
  get avatarAlbumChooser() {
    return this.serverAlbumEditorSection.querySelector(
      "div.album>span.cover>input"
    );
  }

  get editorDelete() {
    return this.serverAlbumEditorSection.querySelector(
      "div.control>button.delete"
    );
  }
  get editorCancel() {
    return this.serverAlbumEditorSection.querySelector(
      "div.control>button.cancel"
    );
  }

  /**
   * Handles that activity has changed from false to true.
   */
  async processActivated() {
    // Make this method asynchronous
    const section =
      this.viewsSectionTemplate.content.firstElementChild.cloneNode(true);
    while (this.center.lastElementChild) this.center.lastElementChild.remove();
    this.center.append(section);

    try {
      // Immediately save the album
      const albums_list = await this.#invokeQueryAllAlbums(); // invoke all albums
      // console.log("query all albums", albums_list);

      // Await the promise to get the resolved array of albums
      // to do only on add event listener we call the tracks.
      for (const album of albums_list) {
        // console.log("album one is ", album);
        this.#invokeAlbum(album);
      }
    } catch (error) {
      console.error("Error fetching albums:", error);
    }

    this.viewsSectionSection
      .querySelector("div.control>button.create")
      .addEventListener("click", (event) => this.processDisplayAlbumEditor());
  }

  async processDisplayAlbumEditor() {
    const sessionOwner = this.sharedProperties["session-owner"];
    this.viewsSectionSection.classList.add("hidden");

    // Clone editor section template
    const tableRow =
      this.editorSectionTemplate.content.firstElementChild.cloneNode(true);
    this.center.append(tableRow);

    // Set cover image source
    const imageCoverSource =
      this.sharedProperties["service-origin"] +
      "/services/documents/" +
      sessionOwner.avatar.identity;
    const imageCoverAvatar = tableRow.querySelector(
      "div.album>span.cover>button>img"
    );
    imageCoverAvatar.src = imageCoverSource;

    // save album into database
    const albumIdentity = await this.#invokeSaveAlbum();
    const GetSavedAlbum = await this.#getAlbumByIdentity(albumIdentity);
    this.avatarAlbumViewer.addEventListener("dragover", (event) =>
      this.validateAvatarTransfer(event.dataTransfer)
    );
    this.avatarAlbumViewer.addEventListener("drop", (event) =>
      this.processSubmitAlbumAvatar(GetSavedAlbum, event.dataTransfer.files[0])
    );

    //delete album or return to albums
    this.editorCancel.addEventListener("click", (event) =>
      this.processReturnToAlbums()
    );
    this.editorDelete.addEventListener("click", (event) =>
      this.procesRemoveAlbum(GetSavedAlbum)
    );

    // Now allow track creation
    const buttonTrack = this.serverAlbumEditorSection.querySelector(
      "div.tracks>div.control>button.create"
    );
    let track;
    // console.log("album has been created successfully", GetSavedAlbum.identity);
    buttonTrack.addEventListener("click", () =>
      this.#invokeCreateOrUpdateTrack(GetSavedAlbum.identity, (track = {}))
    );
  }

  // only for save
  async #invokeCreateOrUpdateAlbum(album) {
    // console.log("Updating album:", JSON.stringify(album));
    const resource =
      this.sharedProperties["service-origin"] + "/services/albums";
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/plain",
    };

    const response = await fetch(resource, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(album),
      credentials: "include",
    });

    if (!response.ok) {
      const errorResponse = await response.text(); // Get additional error info
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}. Response: ${errorResponse}`
      );
    }

    return window.parseInt(await response.json());
  }

  async #invokeQueryAllAlbums() {
    // console.log("3333");
    const resource =
      this.sharedProperties["service-origin"] + "/services/albums";
    const headers = { Accept: "application/json" };
    const response = await fetch(resource, {
      method: "GET",
      headers: headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " " + response.statusText);
    }

    const albums = await response.json();
    return albums;
  }

  // it invokes the album header for editing
  // yes 0
  async #processQueryAlbum(album) {
    this.viewsSectionSection.classList.add("hidden");
    const albumTemplate =
      this.editorSectionTemplate.content.firstElementChild.cloneNode(true);
    this.center.append(albumTemplate);

    const accessSaveButton = this.serverAlbumEditorSection.querySelector(
      "div.control>button.submit"
    );
    this.viewsSectionSection
      .querySelector("div.albums>div>table>tbody")
      .append(this.ServerEditorRowsection);

    accessSaveButton.addEventListener("click", (event) =>
      this.#invokeUpdateAlbum(album.identity)
    );

    this.avatarAlbumViewer.addEventListener("dragover", (event) =>
      this.validateAvatarTransfer(event.dataTransfer)
    );
    this.avatarAlbumViewer.addEventListener("drop", (event) =>
      this.processSubmitAlbumAvatar(album, event.dataTransfer.files[0])
    );
    const accessButtonImage = this.serverAlbumEditorSection.querySelector(
      "div.album>span.cover>button>img"
    );
    accessButtonImage.src =
      this.sharedProperties["service-origin"] +
      "/services/documents/" +
      album.cover.identity;

    this.editorCancel.addEventListener("click", (event) =>
      this.processReturnToAlbums()
    );
    this.editorDelete.addEventListener("click", (event) =>
      this.procesRemoveAlbum(album)
    );

    // Get the updated values of the inputs when the save button is clicked
    const title = this.serverAlbumEditorSection.querySelector(
      "div.album>span.other>div.title>input"
    );
    title.value = album.title.trim() || "";

    const releaseYear = this.serverAlbumEditorSection.querySelector(
      "div.album>span.other>div.release-year>input"
    );
    releaseYear.value = parseInt(album.releaseYear || "null");

    const trackCount = this.serverAlbumEditorSection.querySelector(
      "div.album>span.other>div.track-count>input"
    );
    trackCount.value = parseInt(album.trackCount || "0");

    // invoke tracks for each album when clicking on the album
    await this.#processQuerySingleTrack(album,this.#track = {});
    const buttonTrackUpdate = this.serverAlbumEditorSection.querySelector(
      "div.tracks>div.control>button.create"
    );
    buttonTrackUpdate.addEventListener("click", (event) => {
      // console.log("clicked success");
      this.#invokeCreateOrUpdateTrack(album, (this.#track = {})
    );
    });
    // console.log("track lists are: ",tracks_list);
  }

  // invoke each album row in the albums table
  async #invokeAlbum(album) {
    // console.log("newwwwwwwwww ALbum track",album);

    const ServerEditorRowsection =
      this.viewsServerEditorRowTemplate.content.firstElementChild.cloneNode(
        true
      );
    const accessButton =
      ServerEditorRowsection.querySelector("td.access>button");
    const accessButtonImage = ServerEditorRowsection.querySelector(
      "td.access>button>img"
    );
    accessButtonImage.src =
      this.sharedProperties["service-origin"] +
      "/services/documents/" +
      album.cover.identity;
    // console.log(
    //   "accessButtonImage.srcaccessButtonImage.src",
    //   accessButtonImage.src
    // );

    const artist = ServerEditorRowsection.querySelector("td.artist.text");
    artist.innerText = album.artist || "various artist";

    const title = ServerEditorRowsection.querySelector("td.title.text");
    title.innerText = album.title || "";

    const genre = ServerEditorRowsection.querySelector("td.genre.text");
    genre.innerText = album.genre || "various genre";

    const year = ServerEditorRowsection.querySelector("td.release-year.number");
    year.innerText = parseInt(album.releaseYear || "0");

    const tracks = ServerEditorRowsection.querySelector(
      "td.track-count.number"
    );
    tracks.innerText = `${
      parseInt(album.trackReferences.length || "0") + "/" + album.trackCount
    }`;

    // const trackSection = this.serverAlbumEditorSection.append();
    this.viewsSectionSection
      .querySelector("div.albums>div>table>tbody")
      .append(ServerEditorRowsection);

    accessButton.addEventListener("click", (event) =>
      this.#processQueryAlbum(album)
    );
  }


  // only for saving new track directly after creating new album
  //yes after for loop
  async #processQuerySingleTrack(album,track) {
    // Clear the existing tracks before appending new ones
    this.serverAlbumEditorSectionTable.innerHTML = "";

    // Fetch or call each track reference number in the album
    for (let trackIdReference of album.trackReferences) {
        console.log("trackrefiddddddddddddd",trackIdReference);
        const serverEditorTrackRow = this.editorTrackTemplate.content.firstElementChild.cloneNode(true);
        const singleTrack = await this.#invokeGetTrack(trackIdReference);

        // Set values for the specific track row
        serverEditorTrackRow.querySelector("tr>td.ordinal>input").value = singleTrack.ordinal || null;
        serverEditorTrackRow.querySelector("tr>td.artist>input").value = singleTrack.artist || "";
        serverEditorTrackRow.querySelector("tr>td.title>input").value = singleTrack.title || "";
        serverEditorTrackRow.querySelector("tr>td.genre>input").value = singleTrack.genre || "";
        const recordingButton = serverEditorTrackRow.querySelector("td.recording>button");
        recordingButton.innerText = singleTrack.recording?.description || "No Recording";

        // Append the track row to the table
        const serverAlbumEditorTableNew = this.serverAlbumEditorSection.querySelector("div.tracks>div.data>table>tbody");
        serverAlbumEditorTableNew.append(serverEditorTrackRow);

        // Event listener for deleting the track
        serverEditorTrackRow
            .querySelector("td.action>button.remove")
            .addEventListener("click", () => this.processDeleteTrack(serverEditorTrackRow, album, trackIdReference));

        // Event listener for selecting a recording
        serverEditorTrackRow
            .querySelector("td.recording>button")
            .addEventListener("click", () => serverEditorTrackRow.querySelector("td.recording>input").click());

        // Handle file input change for updating recording
        serverEditorTrackRow
            .querySelector("td.recording>input")
            .addEventListener("change", (event) => this.processSelectTrackRecordUpdate(serverEditorTrackRow, singleTrack, event.target.files[0]));

        // console.log("Track successfully selected");

        // Event listener for submitting the track update
        if (!track.recording) track.recording = {};
        const accessTrackNewButton = serverEditorTrackRow.querySelector("td.action>button.submit");
        accessTrackNewButton.addEventListener("click", async () => {
            // Get values from the current track row's input fields
            // console.log("track before update is:",track);
            track.ordinal = window.parseInt(serverEditorTrackRow.querySelector("td.ordinal>input").value.trim() || "1");
            track.title = serverEditorTrackRow.querySelector("td.title>input").value.trim() || null;
            track.artist = serverEditorTrackRow.querySelector("td.artist>input").value.trim() || null;
            track.genre = serverEditorTrackRow.querySelector("td.genre>input").value.trim() || null;
            track.recording.description = serverEditorTrackRow.querySelector("td.recording>button").innerText || "";

            // Prepare the updated track data
            if (singleTrack) {
                // console.log("final track.recording is: ",track.recording);
                try {
                    track = {...singleTrack,ordinal: track.ordinal, title:track.title, artist: track.artist, genre: track.genre,version: singleTrack.version };
                    
                    // console.log("final track after update", track);
                    await this.#processUpdateTrack(album, track,singleTrack);
                } catch (error) {
                    console.error("Error saving track:", error);
                }
            } 
          
          });
    }
}


  async #invokeCreateOrUpdateTrack(album, track) {
        // console.log("identityyyyyyyyyy", album.identity);
        // console.log("in 1");
        // this.serverAlbumEditorSectionTable.innerHTML = "";

        // Clone the track template for a new track
        const trackTemplate =
        this.editorTrackTemplate.content.firstElementChild.cloneNode(true);
        this.serverAlbumEditorSectionTable.append(trackTemplate); // Add the new track row to the table
        //const singleTrack = await this.#invokeGetTrack(trackIdReference);
        // Get the submit button for the newly added track row
        trackTemplate
        .querySelector("td.recording>button")
        .addEventListener("click", (event) => {
            // console.log("in 2");
            trackTemplate.querySelector("td.recording>input").click();
        });

        trackTemplate
        .querySelector("td.recording>input")
        .addEventListener("change", (event) =>
            this.processSelectTrackRecord(
            trackTemplate,
            track,
            event.target.files[0],
            album
            )
        );
  }


    async #processUpdateTrack(album, updatedTrack,singleTrack) {
        try {
            // Invoke the API call to save the updated track
            const response = await this.#invokeSaveUpdatedTrack(album, updatedTrack);
            singleTrack.version = (singleTrack.version || 0) + 1;
        } catch (error) {
            console.error("Error while updating track:", error);
            // Optionally, handle the error to notify the user
        }
    }


  // get track from database
  async #invokeGetTrack(trackNumber) {
    const resource =
      this.sharedProperties["service-origin"] +
      "/services/tracks/" +
      trackNumber;
    const headers = { Accept: "application/json" };
    const response = await fetch(resource, {
      method: "GET",
      headers: headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " " + response.statusText);
    }
    return await response.json();
  }

  // save NEW track in database
  async #invokeSaveTrack(album, track) {
    const resource =
      this.sharedProperties["service-origin"] +
      "/services/albums/" +
      album.identity +
      "/tracks";
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/plain",
    };
    const response = await fetch(resource, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(track),
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("HTTP " + response.status + " " + response.statusText);
    return window.parseInt(await response.json());
  }

  // update track in database
  async #invokeSaveUpdatedTrack(album, trackUpdatedFinal) {
    // console.log("track identity updated", JSON.stringify(trackUpdatedFinal));
    // console.log("aliiiiiiiiiiiiiiiiiiiiiiiiii",album.identity);
    const resource =
      this.sharedProperties["service-origin"] +
      "/services/albums/" +
      album.identity +
      "/tracks";
    // console.log("resource",resource);
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/plain",
    };
    const response = await fetch(resource, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(trackUpdatedFinal),
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("HTTP " + response.status + " " + response.statusText);
    return window.parseInt(await response.json());
  }

  async #getAlbumByIdentity(identity) {
    const resource = `${this.sharedProperties["service-origin"]}/services/albums/${identity}`;
    const response = await fetch(resource, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch album: " + response.statusText);
    }
    return await response.json();
  }

  // save only new album
  async #invokeSaveAlbum() {
    // Add event listener for the save button
    const speichernButton = this.serverAlbumEditorSection.querySelector(
      "div.control>button.submit"
    );

    return new Promise((resolve, reject) => {
      speichernButton.addEventListener(
        "click",
        async (event) => {
          try {
            // Get the updated values of the inputs when the save button is clicked
            const title = this.serverAlbumEditorSection
              .querySelector("div.album>span.other>div.title>input")
              .value.trim();
            const releaseYear = this.serverAlbumEditorSection
              .querySelector("div.album>span.other>div.release-year>input")
              .value.trim();
            const trackCount = this.serverAlbumEditorSection
              .querySelector("div.album>span.other>div.track-count>input")
              .value.trim();

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
        },
        { once: true }
      ); // Ensure the event listener is executed only once
    });
  }

  async #invokeUpdateAlbum(identity) {
    try {
      // Fetch the current album data
      const currentAlbum = await this.#getAlbumByIdentity(identity);

      // Ensure the identity and current version are valid
      if (
        !currentAlbum ||
        !currentAlbum.identity ||
        currentAlbum.version === undefined
      ) {
        throw new Error("Album not found or invalid data.");
      }

      // Get updated values from the input fields
      const title = this.serverAlbumEditorSection
        .querySelector("div.album>span.other>div.title>input")
        .value.trim();
      const releaseYear = this.serverAlbumEditorSection
        .querySelector("div.album>span.other>div.release-year>input")
        .value.trim();
      const trackCount = this.serverAlbumEditorSection
        .querySelector("div.album>span.other>div.track-count>input")
        .value.trim();

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
      // console.log("Album updated successfully:", result);
      return result;
    } catch (error) {
      console.error("Error updating the album:", error);
      throw error; // Rethrow error for further handling if needed
    }
  }

  async validateAvatarTransfer(dataTransfer) {
    const primaryItem = dataTransfer.items[0];
    dataTransfer.dropEffect =
      primaryItem.kind === "file" &&
      primaryItem.type &&
      primaryItem.type.startsWith("image/")
        ? "copy"
        : "none";
  }

  async processSubmitAlbumAvatar(album, avatarFile) {
    try {
      album.cover.identity = await this.#invokeInsertOrUpdateDocument(
        avatarFile
      );
      album.cover.description = avatarFile.name;
      await this.#invokeCreateOrUpdateAlbum(album);
      this.avatarAlbumViewer.src =
        this.sharedProperties["service-origin"] +
        "/services/documents/" +
        album.cover.identity;

      this.messageOutput.value = "ok.";
    } catch (error) {
      this.messageOutput.value = error.message || error.toString();
      console.error(error);
    }
  }

  async #invokeInsertOrUpdateDocument(file) {
    const headers = {
      Accept: "text/plain",
      "Content-Type": file.type,
      "X-Content-Description": file.name,
    };
    const resource =
      this.sharedProperties["service-origin"] + "/services/documents";

    const response = await fetch(resource, {
      method: "POST",
      headers: headers,
      body: file,
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("HTTP " + response.status + " " + response.statusText);
    return window.parseInt(await response.text());
  }

  async processReturnToAlbums() {
    try {
      console.log("is returning");
      this.serverAlbumEditorSection.remove();
      this.viewsSectionSection.classList.remove("hidden");
      // console.log("1111");
      this.processActivated();


      this.messageOutput.value = "ok";
    } catch (error) {
      this.messageOutput.value = error.message;
      console.error(error);
    }
  }
  async #invokeDeleteTrack(album, trackId) {
    const resource =
      this.sharedProperties["service-origin"] +
      "/services/albums/" +
      album.identity +
      "/tracks/" +
      trackId;
    const headers = { Accept: "text/plain" };

    const response = await fetch(resource, {
      method: "DELETE",
      headers: headers,
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("HTTP " + response.status + " " + response.statusText);

    return window.parseInt(await response.text());
  }

  async #invokeRemoveAlbum(album) {
    const resource =
      this.sharedProperties["service-origin"] +
      "/services/albums/" +
      album.identity;
    const headers = { Accept: "text/plain" };

    const response = await fetch(resource, {
      method: "DELETE",
      headers: headers,
      credentials: "include",
    });
    if (!response.ok)
      throw new Error("HTTP " + response.status + " " + response.statusText);

    return window.parseInt(await response.text());
  }

  async procesRemoveAlbum(album) {
    try {
      await this.#invokeRemoveAlbum(album);
      this.processReturnToAlbums();

      this.messageOutput.value = "ok";
    } catch (error) {
      this.messageOutput.value = error.message;
      console.error(error);
    }
  }

  async processDeleteTrack(trackRow, album, trackId) {
    try {
      await this.#invokeDeleteTrack(album, trackId);
      trackRow.remove();

      this.messageOutput.value = "ok";
    } catch (error) {
      this.messageOutput.value = error.message;
      console.error(error);
    }
  }

  async processSelectTrackRecordUpdate(tableRow, track, trackFile) {
    try {
      // console.log("trackkk",track);
      // console.log("track recording before update", track.recording.description);
      if (!track.recording) track.recording = {};

      track.recording.identity = await this.#invokeInsertOrUpdateDocument(
        trackFile
      );
      track.recording.description = trackFile.name;
      // console.log("aliiiiiiiiiiiiTrack",track.recording);
      // console.log("track.recoring.identity",track.recording.identity);
      tableRow.querySelector("td.recording>button").innerText = trackFile.name;
      // console.log("track recording after update", track.recording.description);


      this.messageOutput.value = "ok";
    } catch (error) {
      this.messageOutput.value = error.message;
      console.error(error);
    }
  }
  async processSelectTrackRecord (tableRow, track, trackName,album) {
    try {

        if (!track.recording) track.recording = {};
        track.recording.description = trackName.name;
        track.recording.identity = await this.#invokeInsertOrUpdateDocument(trackName);
        // console.log("track.recoring.identity",track.recording.identity);
        tableRow.querySelector("td.recording>button").innerText = trackName.name;

        // Attach event listener for the submit button in the new track row
        const actionSubmit = tableRow.querySelector("tr>td.action>button.submit");
        actionSubmit.addEventListener("click", async (event) => {
          // console.log("1");
          if(!track.identity){
            try {
                
                // console.log("in3");
                if (!track.recording) track.recording = {};

                // Get values from the current track row's input fields
                track.ordinal = window.parseInt(tableRow.querySelector("td.ordinal>input").value.trim() || "1");
                track.title = tableRow.querySelector("td.title>input").value.trim() || null;
                track.artist = tableRow.querySelector("td.artist>input").value.trim() || null;
                track.genre = tableRow.querySelector("td.genre>input").value.trim() || null;
                track.recording.description = tableRow.querySelector("td.recording>button").innerText || ""

                const track_number = await this.#invokeSaveTrack(album, track);
                console.log("track_number",track_number);
                if (!album.trackReferences) album.trackReferences = [];
                album.trackReferences.push(track_number);
                this.#processQuerySingleTrack(album,track);

              
            } catch (error) {
                console.error("Error saving track:", error);
            }
          }

        });
      


        this.messageOutput.value = "ok";
    } catch (error) {
        this.messageOutput.value = error.message;
        console.error(error);
    }
}
}

/*
 * Registers an event handler for the browser window's load event.
 */
window.addEventListener("load", event => {
    const controller = new EditorTabController();
    console.log(controller);
});