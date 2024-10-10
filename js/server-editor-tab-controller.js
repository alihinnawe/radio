import TabController from "../../../tool/tab-controller.js";


/**
 * Skeleton for tab controller type.
 */
class EditorTabController extends TabController {

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


	/**
	 * Handles that activity has changed from false to true.
	 */
	processActivated () {
		const section = this.viewsSectionTemplate.content.firstElementChild.cloneNode(true);
		while (this.center.lastElementChild) this.center.lastElementChild.remove();
		this.center.append(section);

		this.viewsSectionSection.querySelector("div.control>button.create").addEventListener("click",event => this.proccessDisplayAlbumEditor());

	     //const albums = this.#invokeQueryAllAlbums();
		//console.log("albums",albums)



		// register basic event listeners
	}


	async #invokeQueryAllAlbums () {
		const resource = this.sharedProperties["service-origin"] + "/services/albums";
		console.log("resource",resource);
		const headers = { "Accept": "application/json" };
		const response = await fetch(resource, { method: "GET" , headers: headers, credentials: "include" });
		if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
		return response.json();
	}


	async proccessDisplayAlbumEditor () { 
		const sessionOwner = this.sharedProperties["session-owner"];
		console.log("sessionOwner",sessionOwner);
		this.viewsSectionSection.classList.add("hidden");
		const tableRow = this.editorSectionTemplate.content.firstElementChild.cloneNode(true);
		const imageCover = tableRow.querySelector("")
		this.sharedProperties["service-origin"] + "/services/documents" + 
		
		this.center.append(tableRow);

		const createdElement = await this.#invokeCreateOrUpdateAlbum(album);
		console.log("createdElementcreatedElement",createdElement);
	}


	async #invokeCreateOrUpdateAlbum (album) {
		const resource = this.sharedProperties["service-origin"] + "/services/albums";
		const headers = { "Content-Type": "application/json", "Accept": "text/plain" };
		const response = await fetch(resource, { method: "POST" , headers: headers, body: JSON.stringify(album), credentials: "include" });
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
