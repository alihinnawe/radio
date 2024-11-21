import TabController from "../../../tool/tab-controller.js";
import { sleep } from "../../../tool/threads.js";


/**
 * Preferences tab controller type.
 */
class PreferencesTabController extends TabController {

	/**
	 * Initializes a new instance.
	 */
	constructor () {
		super("preferences");

		// register controller event listeners 
		this.addEventListener("activated", event => this.processActivated());
	}


	// HTML element getter operations
	get preferencesSectionTemplate () { return document.querySelector("head>template.preferences"); }
	get authenticationTabButton () { return this.top.querySelector("nav.tabs>button.authentication"); }

	get preferencesSection () { return this.center.querySelector("section.preferences"); }
	get addButton () { return this.preferencesSection.querySelector("fieldset.phones>button.add"); }
	get submitButton () { return this.preferencesSection.querySelector("div.control>button.submit"); }
	get avatarButton () { return this.preferencesSection.querySelector("div.avatar>button"); }
	get avatarViewer () { return this.avatarButton.querySelector("img"); }
	get avatarChooser () { return this.preferencesSection.querySelector("div.avatar>input"); }
	get emailInput () { return this.preferencesSection.querySelector("div.email>input"); }
	get passwordInput () { return this.preferencesSection.querySelector("div.password>input"); }
	get groupSelector () { return this.preferencesSection.querySelector("div.group>select"); }
	get titleInput () { return this.preferencesSection.querySelector("div.title>input"); }
	get surnameInput () { return this.preferencesSection.querySelector("div.surname>input"); }
	get forenameInput () { return this.preferencesSection.querySelector("div.forename>input"); }
	get postcodeInput () { return this.preferencesSection.querySelector("div.postcode>input"); }
	get streetInput () { return this.preferencesSection.querySelector("div.street>input"); }
	get cityInput () { return this.preferencesSection.querySelector("div.city>input"); }
	get countryInput () { return this.preferencesSection.querySelector("div.country>input"); }
	get phonesSpan () { return this.preferencesSection.querySelector("fieldset.phones>span"); }


	/**
	 * Handles that activity has changed from false to true.
	 */
	async processActivated () {
		this.messageOutput.value = "";

		// redefine center content
		while (this.center.lastElementChild) this.center.lastElementChild.remove();
		this.center.append(this.preferencesSectionTemplate.content.firstElementChild.cloneNode(true));
		const sessionOwner = this.sharedProperties["session-owner"];
		// console.log(sessionOwner);

		// register basic event listeners
		this.addButton.addEventListener("click", event => this.phonesSpan.append(this.constructor.createPhoneInput(null)));
		this.submitButton.addEventListener("click", event => this.processSubmitPerson(sessionOwner));
		this.avatarButton.addEventListener("click", event => this.avatarChooser.click());
		this.avatarViewer.addEventListener("dragover", event => this.validateAvatarTransfer(event.dataTransfer));
		this.avatarViewer.addEventListener("drop", event => this.processSubmitAvatar(sessionOwner, event.dataTransfer.files[0]));
		this.avatarChooser.addEventListener("change", event => this.processSubmitAvatar(sessionOwner, event.target.files[0]));

		await this.#displayPerson(sessionOwner);
	}


	/**
	 * Displays the given person's data.
	 * @param person the person
	 */
	async #displayPerson (person) {
		this.avatarViewer.src = this.sharedProperties["service-origin"] + "/services/documents/" + person.avatar.identity;
		this.emailInput.value = person.email || "";
		this.groupSelector.value = person.group;
		this.titleInput.value = person.name.title || "";
		this.surnameInput.value = person.name.family || "";
		this.forenameInput.value = person.name.given || "";
		this.postcodeInput.value = person.address.postcode || "";
		this.streetInput.value = person.address.street || "";
		this.cityInput.value = person.address.city || "";
		this.countryInput.value = person.address.country || "";

		this.phonesSpan.innerHTML = "";
		for (const phone of person.phones)
			this.phonesSpan.append(this.constructor.createPhoneInput(phone));

		await sleep(100);
		this.passwordInput.value = "";
	}


	/**
	 * Performs submitting the given person's data.
	 * @param person the person
	 */
	async processSubmitPerson (person) {
		try {
			const password = this.passwordInput.value.trim() || null;
			const personClone = window.structuredClone(person);
			personClone.email = this.emailInput.value.trim() || null;
			personClone.group = this.groupSelector.value.trim() || null;
			personClone.name.title = this.titleInput.value.trim() || null;
			personClone.name.family = this.surnameInput.value.trim() || null;
			personClone.name.given = this.forenameInput.value.trim() || null;
			personClone.address.postcode = this.postcodeInput.value.trim() || null;
			personClone.address.street = this.streetInput.value.trim() || null;
			personClone.address.city = this.cityInput.value.trim() || null;
			personClone.address.country = this.countryInput.value.trim() || null;

			personClone.phones.length = 0;
			for (const phoneField of this.phonesSpan.querySelectorAll("input.phone")) {
				const phone = phoneField.value.trim() || null;
				if (phone) personClone.phones.push(phone);
			}

			await this.#invokeInsertOrUpdatePerson(personClone, password);
			this.messageOutput.value = "ok.";

			if (personClone.email !== person.email || password) {
				this.authenticationTabButton.click();
			} else {
				for (const key in personClone)
					person[key] = personClone[key];
				person.version = (person.version || 0) + 1;
				this.#displayPerson(person);
			}
		} catch (error) {
			this.#displayPerson(person);
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Performs validating an avatar transfer attempt.
	 * @param dataTransfer the avatar transfer
	 */
	async validateAvatarTransfer (dataTransfer) {
		const primaryItem = dataTransfer.items[0];
		dataTransfer.dropEffect = primaryItem.kind === "file" && primaryItem.type && primaryItem.type.startsWith("image/") ? "copy" : "none";
	}


	/**
	 * Performs submitting the given person's avatar.
	 * @param person the person
	 * @param avatarFile the avatar image file
	 */
	async processSubmitAvatar (person, avatarFile) {
		try {
			person.avatar.identity = await this.#invokeInsertOrUpdateDocument(avatarFile);
			this.avatarViewer.src = this.sharedProperties["service-origin"] + "/services/documents/" + person.avatar.identity;

			this.messageOutput.value = "ok.";
		} catch (error) {
			this.messageOutput.value = error.message || error.toString();
			console.error(error);
		}
	}


	/**
	 * Remotely invokes the web-service method with HTTP signature
	 * POST /services/people application/json text/plain,
	 * and returns a promise for the resulting session owner's identity.
	 * @param person the person
	 * @param password the session owner's new password, or null for none
	 * @return a promise for the resulting session owner's identity
	 * @throws if the TCP connection to the web-service cannot be established, 
	 *			or if the HTTP response is not ok
	 */
	async #invokeInsertOrUpdatePerson (person, password = null) {
		const headers = { "Accept": "text/plain", "Content-Type": "application/json" };
		if (password) headers["X-Set-Password"] = password;
		const resource = this.sharedProperties["service-origin"] + "/services/people";
		const body = JSON.stringify(person);

		const response = await fetch(resource, { method: "POST" , headers: headers, body: body, credentials: "include" });
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


	/**
	 * Creates and returns a phone input.
	 * @param phone the phone number, or null for none
	 * @return the phone input element created
	 */
	static createPhoneInput (phone = null) {
		const phoneInput = document.createElement("input");
		phoneInput.type = "tel";
		phoneInput.value = phone || "";
		phoneInput.classList.add("phone");
		return phoneInput;
	}
}


/*
 * Registers an event listener for the browser window's load event.
 */
window.addEventListener("load", event => {
	const controller = new PreferencesTabController();
	console.log(controller);
});
