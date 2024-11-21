import Controller from "../../tool/controller.js";


/**
 * Skeleton for tab controller type.
 */
class SkeletonTabController extends Controller {

	/**
	 * Initializes a new instance.
	 */
	constructor () {
		super("<style-class>");

		// register controller event listeners 
		this.addEventListener("activated", event => this.processActivated());
		// this.addEventListener("deactivated", event => this.processDeactivated());
	}


	/**
	 * Handles that activity has changed from false to true.
	 */
	processActivated () {
		const sectionTemplate = document.querySelector("template.<template-style-class>");
		section = sectionTemplate.content.firstElementChild.cloneNode(true);
		this.center.append(section);

		// register basic event listeners
	}
}


/*
 * Registers an event handler for the browser window's load event.
 */
window.addEventListener("load", event => {
	const controller = new SkeletonTabController();
	console.log(controller);
});
