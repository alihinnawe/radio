import TabController from "../../../tool/tab-controller.js";
import xhr from "../../../tool/xhr.js";


// Calculate the value of the web-service server origin. For same origin policy (SOP)
// access, this must be set to the current DOM's origin, as the web-server must also
// host the web-services. For cross-origin resource sharing (CORS) access, this must be
// set to the web-service server's origin instead, which will differ from the
// web-server's origin!
const serviceProtocol = document.location.protocol;
const serviceHostname = document.location.hostname;
const servicePort = 8020; // document.location.port;
const serviceOrigin = serviceProtocol + "//" + serviceHostname + ":" + servicePort;


/**
 * Authentication tab controller type.
 */
class AuthenticationTabController extends TabController {

	/**
	 * Initializes a new instance.
	 */
	constructor () {
		super("authentication");

		// set a shared property for the web-service server origin
		this.sharedProperties["service-origin"] = serviceOrigin;

		// register controller event listeners 
		this.addEventListener("activated", event => this.processActivated());
	}


	// HTML element getter operations
	get authenticationSectionTemplate () { return document.querySelector("head>template.authentication"); }
	get tabButtons () { return Array.from(this.top.querySelectorAll("nav.tabs>button")); }

	get authenticationSection () { return this.center.querySelector("section.authentication"); }
	get authenticationButton () { return this.authenticationSection.querySelector("div.control>button.authenticate"); }
	get emailInput () { return this.authenticationSection.querySelector("div.email>input"); }
	get passwordInput () { return this.authenticationSection.querySelector("div.password>input"); }


	/**
	 * Handles that activity has changed from false to true.
	 */
	async processActivated () {
		this.messageOutput.value = "";
		for (const tabControl of this.tabButtons)
			tabControl.disabled = tabControl !== this.tabControl;

		// redefine center content
		while (this.center.lastElementChild) this.center.lastElementChild.remove();
		this.center.append(this.authenticationSectionTemplate.content.firstElementChild.cloneNode(true));

		// register basic event listeners
		this.authenticationButton.addEventListener("click", event => this.processAuthentication());

		// log out the current session owner
		try {
			this.sharedProperties["session-owner"] = null;
			await this.#invokeFindSessionOwner(null, null);
		} catch (error) {
			// do nothing
		} finally {
			console.log("logout complete.")
		}
	}


	/**
	 * Performs user authentication.
	 */
	async processAuthentication () {
		try {
			const email = this.emailInput.value.trim() || null;
			const password = this.passwordInput.value.trim() || null;
			this.sharedProperties["session-owner"] = await this.#invokeFindSessionOwner(email, password);

			for (const tabControl of this.top.querySelectorAll("nav.tabs>*"))
				tabControl.disabled = false;

			if (!("audio-context" in this.sharedProperties))
				this.sharedProperties["audio-context"] = new AudioContext();

			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * GET /services/people/requester - application/json,
	 * and returns a promise for the resulting session owner.
	 * @param email the requester email, or null for none
	 * @param password the requester password, or null for none
	 * @return a promise for the resulting session owner
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeFindSessionOwner (email, password) {
		const resource = this.sharedProperties["service-origin"] + "/services/people/requester";
		const headers = { "Accept": "application/json" };

		return xhr(resource, "GET", headers, null, "json", email || "-", password || "-");
	}
}


/*
 * Registers an event listener for the browser window's load event.
 */
window.addEventListener("load", event => {
	const controller = new AuthenticationTabController();
	console.log(controller);

	// activate initial tab
	if (controller.tabControl) controller.tabControl.click();
});
