/** A simple class for handling file drag over events. */
export class FileHandler {
    /** @param {World} world */
    constructor(world, gcodeParseCallback) {
        this.world = world;
        this.parseCallback = gcodeParseCallback;

        // Create the file drag and drop handler
        document.body.ondrop = (ev) => {
            console.log('File(s) dropped');

            // Open the file text and load the GCode
            if (ev.dataTransfer.items) {
                if (ev.dataTransfer.items[0].kind === 'file') {
                    ev.dataTransfer.items[0].getAsFile().text().then((text) => {
                        this.parseCallback(text);
                    });
                }
            } else {
                ev.dataTransfer.files[0].text().then((text) => {
                    this.parseCallback(text);
                });
            }
            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
            this.world.container.style.border = "none";
        };
        document.body.ondragover = (ev) => {
            ev.dataTransfer.dropEffect = 'copy';
            this.world.container.style.border = "5px solid #0af";
            ev.preventDefault();
        };
        document.body.ondragleave = (ev) => { this.world.container.style.border = "none"; }
        document.body.ondragend   = (ev) => { this.world.container.style.border = "none"; }
    }

    async openFile() {
        let options = {
            types: [{
                    description: "Pre-Sliced GCode",
                    accept: {
                        ['text/x-gcode']: ['.gcode'],
                    }}]};
        let fileHandle = await window.showOpenFilePicker(options);

        let fileSystemFile = await fileHandle[0].getFile();
        let gcodeContent = await fileSystemFile.text();
        this.parseCallback(gcodeContent);
    }
}
