
let classifierSession;
let segmenterSession;
let editableMask = null;
let segmentationCanvas = null;
let segmentationCtx = null;
let lastOriginalCanvas = null;
let dotVisibility = 0;
let maskOpacity = 0.2;
let cropInfo = null;
let modelsReady;
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let maskOffsetX = 0;
let maskOffsetY = 0;
let controlPoints = [];
let selectedPoint = null;
let numImageInput = 0;
let switchButtonClicks = 0;
let fileName = "";

const classes = [
    "glioma",
    "meningioma",
    "no_tumor",
    "pituitary"
];
function getFileName(file){
    fileName = file;
}

function exportCanvasAsImage(filename = fileName) {
    const maskName = fileName.replace(/\./, "_M.");
    if (!editableMask || !lastOriginalCanvas || !cropInfo) {
        console.error("Nothing to export.");
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = lastOriginalCanvas.width;
    canvas.height = lastOriginalCanvas.height;

    const ctx = canvas.getContext("2d");

    // Black background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // White mask
    ctx.fillStyle = "white";

    const scaleX = cropInfo.width / 512;
    const scaleY = cropInfo.height / 512;

    for (let y = 0; y < 512; y++) {

        for (let x = 0; x < 512; x++) {

            const srcX = x - maskOffsetX;
            const srcY = y - maskOffsetY;

            if (
                srcX < 0 ||
                srcY < 0 ||
                srcX >= 512 ||
                srcY >= 512
            ) {
                continue;
            }

            const index =
                Math.floor(srcY) * 512 +
                Math.floor(srcX);

            if (editableMask[index] !== 1) {
                continue;
            }

            const drawX =
                cropInfo.x + x * scaleX;

            const drawY =
                cropInfo.y + y * scaleY;

            ctx.fillRect(
                drawX,
                drawY,
                scaleX,
                scaleY
            );
        }
    }

    const link = document.createElement("a");
    link.download = maskName;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

let history = [];
let historyIndex = -1;
function saveHistory() {

    // Remove future states if we undo then edit
    history =
        history.slice(0, historyIndex + 1);

    // Save current mask and points
    history.push({
        mask: new Uint8Array(editableMask),
        points: controlPoints.map(p => ({
            x: p.x,
            y: p.y
        })),
        offsetX: maskOffsetX,
        offsetY: maskOffsetY
    });

    historyIndex++;

}
function undoEdit() {

    if(historyIndex <= 0){
        console.log("Nothing to undo");
        return;
    }

    historyIndex--;

    const state = history[historyIndex];

    editableMask =
        new Uint8Array(state.mask);

    controlPoints =
        state.points.map(p => ({
            x:p.x,
            y:p.y
        }));

    maskOffsetX = state.offsetX;
    maskOffsetY = state.offsetY;


    redrawMask(lastOriginalCanvas);

}
function contourToMask(controlPoints) {

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 512, 512);

    ctx.fillStyle = "white";

    ctx.beginPath();

    ctx.moveTo(
        controlPoints[0].x,
        controlPoints[0].y
    );

    for (let i = 1; i < controlPoints.length; i++) {

        ctx.lineTo(
            controlPoints[i].x,
            controlPoints[i].y
        );

    }

    ctx.closePath();

    ctx.fill();

    const img =
        ctx.getImageData(0,0,512,512).data;

    const mask =
        new Uint8Array(512*512);

    for(let i=0;i<mask.length;i++){

        mask[i] =
            img[i*4] > 0 ? 1 : 0;

    }

    return mask;

}
function traceContour(mask) {

    const W = 512;
    const H = 512;

    // Find first foreground pixel
    let sx = -1;
    let sy = -1;

    outer:
    for (let y = 1; y < H - 1; y++) {

        for (let x = 1; x < W - 1; x++) {

            if (mask[y * W + x]) {

                sx = x;
                sy = y;

                break outer;

            }

        }

    }

    if (sx === -1)
        return [];

    const dirs = [

        [ 1, 0],
        [ 1, 1],
        [ 0, 1],
        [-1, 1],
        [-1, 0],
        [-1,-1],
        [ 0,-1],
        [ 1,-1]

    ];

    let contour = [];

    let x = sx;
    let y = sy;

    let previousDir = 6;

    do{

        contour.push({
            x,
            y
        });

        let found = false;

        for(let k=0;k<8;k++){

            const dir =
                (previousDir + k) % 8;

            const nx =
                x + dirs[dir][0];

            const ny =
                y + dirs[dir][1];

            if(

                nx<0 ||
                ny<0 ||
                nx>=W ||
                ny>=H

            )
                continue;

            if(mask[ny*W+nx]){

                x = nx;
                y = ny;

                previousDir =
                    (dir+5)%8;

                found = true;

                break;

            }

        }

        if(!found)
            break;

    }

    while(

        x!==sx ||
        y!==sy

    );

    return contour;

}
function redrawMask(originalCanvas) {

    if (!segmentationCtx || !editableMask)
        return;

    const W = originalCanvas.width;
const H = originalCanvas.height;

segmentationCtx.clearRect(0,0,W,H);

segmentationCtx.drawImage(
    originalCanvas,
    0,
    0
);
    // Make everything drawn after this 20% opaque
    segmentationCtx.globalAlpha = maskOpacity;
    segmentationCtx.fillStyle = "red";

    const scaleX = cropInfo.width / 512;
    const scaleY = cropInfo.height / 512;

for (let y = 0; y < 512; y++) {

    for (let x = 0; x < 512; x++) {

        const srcX = x - maskOffsetX;
        const srcY = y - maskOffsetY;

        if (
            srcX < 0 ||
            srcY < 0 ||
            srcX >= 512 ||
            srcY >= 512
        )
            continue;

        const index =
            Math.floor(srcY) * 512 +
            Math.floor(srcX);

        if (editableMask[index] !== 1)
            continue;

        const drawX =
            cropInfo.x + x * scaleX;

        const drawY =
            cropInfo.y + y * scaleY;

        segmentationCtx.fillRect(
            drawX,
            drawY,
            scaleX,
            scaleY
        );

    }

}

    // Restore normal drawing
    segmentationCtx.fillStyle = "white";
    segmentationCtx.globalAlpha = 1;
    if(dotVisibility%2 === 0){
segmentationCtx.fillStyle = "rgba(255,255,255,1)";
    }
    else{
segmentationCtx.fillStyle = "rgba(255,255,255,0)";
    }
for (const p of controlPoints) {

    segmentationCtx.beginPath();

    const drawX =
    cropInfo.x +
    (p.x + maskOffsetX) * scaleX;

const drawY =
    cropInfo.y +
    (p.y + maskOffsetY) * scaleY;

segmentationCtx.beginPath();

segmentationCtx.arc(

    drawX,

    drawY,

    1.5,

    0,

    Math.PI * 2

);


    segmentationCtx.fill();

}
}
function getBoundary(mask) {

    const boundary = [];

    for (let y = 1; y < 511; y++) {

        for (let x = 1; x < 511; x++) {

            const i = y * 512 + x;

            if (mask[i] !== 1)
                continue;

            if (

                mask[i - 1] === 0 ||
                mask[i + 1] === 0 ||

                mask[i - 512] === 0 ||
                mask[i + 512] === 0 ||

                mask[i - 513] === 0 ||
                mask[i - 511] === 0 ||

                mask[i + 511] === 0 ||
                mask[i + 513] === 0

            ) {

                boundary.push({
                    x,
                    y
                });

            }

        }

    }

    return boundary;

}
function computePerimeter(boundary) {

    let perimeter = 0;

    for (let i = 0; i < boundary.length; i++) {

        const p1 = boundary[i];

        const p2 = boundary[
            (i + 1) % boundary.length
        ];

        perimeter += Math.hypot(

            p2.x - p1.x,

            p2.y - p1.y

        );

    }

    return perimeter;

}
function generateControlPoints(mask){

    const contour =
        traceContour(mask);

    if(contour.length===0)
        return [];

    let perimeter = 0;

    for(let i=0;i<contour.length;i++){

        const a =
            contour[i];

        const b =
            contour[
                (i+1)%contour.length
            ];

        perimeter += Math.hypot(

            b.x-a.x,

            b.y-a.y

        );

    }

    const spacing = 10;

    const numPoints = Math.max(

        8,

        Math.round(
            perimeter/spacing
        )

    );

    const step =
        contour.length/numPoints;

    const controlPoints=[];

    for(let i=0;i<numPoints;i++){

        controlPoints.push({

            ...contour[
                Math.floor(i*step)
            ],

            selected:false

        });

    }

    return controlPoints;

}
function findPoint(mx, my) {

    const scaleX = cropInfo.width / 512;
    const scaleY = cropInfo.height / 512;

    for (const p of controlPoints) {

        const drawX =
            cropInfo.x +
            (p.x + maskOffsetX) * scaleX;

        const drawY =
            cropInfo.y +
            (p.y + maskOffsetY) * scaleY;

        if (
            Math.hypot(
                mx - drawX,
                my - drawY
            ) < 8
        ) {
            return p;
        }
    }

    return null;
}
function startDrag(e){

    const rect =
        segmentationCanvas.getBoundingClientRect();

    const mx =
        e.clientX - rect.left;

    const my =
        e.clientY - rect.top;

    selectedPoint =
        findPoint(mx,my);

    dragging = true;

    dragStartX = mx;

    dragStartY = my;

}

function dragMask(e){

    if(!dragging)
        return;

    const rect =
        segmentationCanvas.getBoundingClientRect();

    const mx =
        e.clientX - rect.left;

    const my =
        e.clientY - rect.top;

    const dx =
        mx - dragStartX;

    const dy =
        my - dragStartY;
const scaleX = cropInfo.width / 512;
const scaleY = cropInfo.height / 512;

const modelDX = dx / scaleX;
const modelDY = dy / scaleY;
    if(selectedPoint){

        selectedPoint.x += modelDX;
selectedPoint.y += modelDY;

editableMask =
    contourToMask(controlPoints);

redrawMask(lastOriginalCanvas);
    }

    else{

        maskOffsetX += modelDX;
maskOffsetY += modelDY;

    }

    dragStartX = mx;

    dragStartY = my;

    redrawMask(lastOriginalCanvas);

}


function endDrag(){
    if(dragging){
        saveHistory();
    }
    dragging = false;

    selectedPoint = null;

}
function displayMask(
    maskData,
    originalCanvas, crop
){

    console.log(
        "Displaying segmentation:",
        maskData.length
    );


    const canvas =
        document.createElement("canvas");


    canvas.width = originalCanvas.width;
    canvas.height = originalCanvas.height;


    const ctx =
        canvas.getContext("2d");


    segmentationCanvas = canvas;
    segmentationCtx = ctx;


    lastOriginalCanvas =
        originalCanvas;



    editableMask =
        new Uint8Array(
            maskData.length
        );


    let tumorPixels = 0;


    for(let i=0;i<maskData.length;i++){


        const probability =
            1/(1+Math.exp(-maskData[i]));


        if(probability > 0.5){

            editableMask[i]=1;
            tumorPixels++;

        }

    }
    

    console.log(
        "Predicted tumor pixels:",
        tumorPixels
    );


    controlPoints = generateControlPoints(editableMask);
    redrawMask(
        originalCanvas
    );

    history = [];
    historyIndex = -1;

    saveHistory();

    const output =
        document.getElementById(
            "segmentationOutput"
        );


    // DO NOT overwrite existing HTML
    


    output.appendChild(canvas);
    canvas.addEventListener(
    "mousedown",
    startDrag
);

    canvas.addEventListener(
    "mousemove",
    dragMask
);

    canvas.addEventListener(
    "mouseup",
    endDrag
);

    canvas.addEventListener(
    "mouseleave",
    endDrag
);
return canvas;
}
function softmax(logits){

    const max = Math.max(...logits);

    const exp =
        logits.map(x => Math.exp(x - max));


    const sum =
        exp.reduce((a,b)=>a+b,0);


    return exp.map(x=>x/sum);

}
function analyzeMask(mask){

    let tumorPixels = 0;

    for(let i=0;i<mask.length;i++){

        const probability =
            1 / (1 + Math.exp(-mask[i]));


        if(probability > 0.5){
            tumorPixels++;
        }

    }


    return (
        tumorPixels / mask.length * 100
    ).toFixed(2);

}
// Load both models
async function loadModels() {

    classifierSession =
await ort.InferenceSession.create(
    "./models/brain_tum_classifier_b3.onnx",
    {
        executionProviders: ["wasm"],
        externalData: [
            {
                path: "brain_tum_classifier_b3.onnx.data",
                data: "./models/brain_tum_classifier_b3.onnx.data"
            }
        ]
    }
);
    console.log("Classifier loaded");
    document.getElementById("classificationStatus"
    ).querySelector("span").innerHTML = "Classification Model Loaded";
    const classifier = document.getElementById("classificationStatus")
    classifier.style.background = `linear-gradient(
        to right,
        #656565,
        #5ee03d,
        #30e02a,
        #0fc22f,
        #757575,
        #656565
    )`;
    classifier.style.backgroundSize = `200%`;
    classifier.style.animation = `animationGradient 0.5s linear infinite, vibrate 1s infinite`;
    classifier.style.boxShadow= `0 0 15px rgba(255,255,255,0.9)`;
    segmenterSession =
        await ort.InferenceSession.create(
    "./models/brain_unet_b3.onnx",
    {
        executionProviders: ["wasm"],
        externalData: [
            {
                path: "brain_unet_b3.onnx.data",
                data: "./models/brain_unet_b3.onnx.data"
            }
        ]
    }
);

    console.log("Segmenter loaded");
    document.getElementById("segmentationStatus"
    ).querySelector("span").innerHTML = "Segmentation Model Loaded";
    const segmenter = document.getElementById("segmentationStatus")
    segmenter.style.background = `linear-gradient(
        to right,
        #656565,
        #5ee03d,
        #30e02a,
        #0fc22f,
        #757575,
        #656565
    )`;
    segmenter.style.backgroundSize = `200%`;
    segmenter.style.animation = `animationGradient 0.5s linear infinite, vibrate 1s infinite`;
    segmenter.style.boxShadow= `0 0 15px rgba(255,255,255,0.9)`;
}

function foregroundCrop(rgb, width, height, margin=10){

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;


    for(let y=0;y<height;y++){

        for(let x=0;x<width;x++){

            const pixel =
                rgb[y*width+x];

            const gray =
                0.299*pixel[0] +
                0.587*pixel[1] +
                0.114*pixel[2];


            if(gray > 10){

                minX=Math.min(minX,x);
                minY=Math.min(minY,y);
                maxX=Math.max(maxX,x);
                maxY=Math.max(maxY,y);

            }
        }
    }


    return {
        x: Math.max(0,minX-margin),
        y: Math.max(0,minY-margin),
        width: maxX-minX+margin*2,
        height: maxY-minY+margin*2
    };
}
// Convert image to ONNX tensor
async function imageToTensor(imageElement) {

    const size = 512;


    // Draw original image to canvas
    const originalCanvas =
        document.createElement("canvas");

    originalCanvas.width =
        imageElement.naturalWidth;

    originalCanvas.height =
        imageElement.naturalHeight;


    const originalCtx =
        originalCanvas.getContext("2d");


    originalCtx.drawImage(
        imageElement,
        0,
        0
    );


    const originalData =
        originalCtx.getImageData(
            0,
            0,
            originalCanvas.width,
            originalCanvas.height
        );


    // Convert RGBA -> RGB array
    const rgb = [];

    for(let i=0;i<originalData.data.length;i+=4){

        rgb.push([
            originalData.data[i],
            originalData.data[i+1],
            originalData.data[i+2]
        ]);

    }



    // Foreground crop
    const cropped =
        foregroundCrop(
            rgb,
            originalCanvas.width,
            originalCanvas.height
        );



    // Resize crop
    const canvas =
        document.createElement("canvas");


    canvas.width = size;
    canvas.height = size;


    const ctx =
        canvas.getContext("2d");


    ctx.drawImage(
    imageElement,
    cropped.x,
    cropped.y,
    cropped.width,
    cropped.height,
    0,
    0,
    size,
    size
);


    const imageData =
        ctx.getImageData(
            0,
            0,
            size,
            size
        );


    const data =
        imageData.data;



    const imageSize =
        size*size;


    const floatBuffer =
        new Float32Array(
            3*imageSize
        );


    const mean =
    [0.485,0.456,0.406];


    const std =
    [0.229,0.224,0.225];



    for(let i=0;i<imageSize;i++){


        const r =
        data[i*4]/255;


        const g =
        data[i*4+1]/255;


        const b =
        data[i*4+2]/255;



        // CHW + Normalize

        floatBuffer[i] =
        (r-mean[0])/std[0];


        floatBuffer[i+imageSize] =
        (g-mean[1])/std[1];


        floatBuffer[i+2*imageSize] =
        (b-mean[2])/std[2];

    }


const displayCrop = {

    x: cropped.x * 512 / originalCanvas.width,

    y: cropped.y * 512 / originalCanvas.height,

    width: cropped.width * 512 / originalCanvas.width,

    height: cropped.height * 512 / originalCanvas.height

};

return {

    tensor: new ort.Tensor(
        "float32",
        floatBuffer,
        [1,3,size,size]
    ),

    originalCanvas,

    crop: cropped

};
}



// ==========================
// CLASSIFICATION
// ==========================

async function runClassifier(imgTensor) {


    const feeds = {};

    feeds[
        classifierSession.inputNames[0]
    ] = imgTensor.tensor;


    const results =
        await classifierSession.run(feeds);


    return results[
        classifierSession.outputNames[0]
    ];

}



// ==========================
// SEGMENTATION
// ==========================

async function runSegmenter(imgTensor){

    const feeds = {};

    feeds[
        segmenterSession.inputNames[0]
    ] = imgTensor.tensor;

    const results =
        await segmenterSession.run(feeds);

    return {
    mask: results[
        segmenterSession.outputNames[0]
    ],

    originalCanvas:
        imgTensor.originalCanvas,

    crop:
        imgTensor.crop
};

}



// Example usage
//force the inference to be asynchronous
//and allow the progress bar to update in real-time
async function analyzeMRI(img, progressCallback) {
    numImageInput++;
    await modelsReady;
    
    console.log("Starting inference");
    

    const loader =
        document.getElementById("loading-screen");


    loader.style.display = "flex";
    const bar = document.getElementById("myProgressBar");
    bar.style.animation = "pulse 2s infinite";
    const progressLabel = document.getElementById("progressLabel");

    await new Promise(resolve =>
        requestAnimationFrame(resolve)
    );


    try {
        //this is to ensure that the progress bar updates before the inference starts
        progressCallback(20, "Converting image to tensor...");
        await new Promise(resolve => requestAnimationFrame(resolve));

        const input = await imageToTensor(img);

        // =====================
        // CLASSIFICATION
        // =====================
        progressCallback(50, "Running classification...");
        await new Promise(resolve => requestAnimationFrame(resolve));

        const classification = await runClassifier(input);


        const scores =
            Array.from(classification.data);


        const probabilities =
            softmax(scores);

        const predictionIndex =
            scores.indexOf(
                Math.max(...scores)
            );
        const prediction = classes[predictionIndex];

        document.getElementById(
            "classificationOutput"
        ).innerHTML = `

        <h3>Classification</h3>

        <p>
        Prediction:
        <b>${classes[predictionIndex]}</b>
        </p>


        <p>
        Scores:
        <br>
        ${
            scores.map(
                (x,i)=>
                classes[i]+": "+x.toFixed(4)
            ).join("<br>")
        }
        </p>


        <p>
        Softmax Probabilities (Classifier's Confidence):
        <br>
        ${
            probabilities.map(
                (x,i)=>
                classes[i]+": "+
                (x*100).toFixed(2)+"%"
            ).join("<br>")
        }
        </p>

        `;



        // =====================
        // SEGMENTATION
        // =====================
        const container = document.getElementById("canvasButtons");
        let tumorArea = 0;
        if (predictionIndex === 2){
            container.innerHTML = ""
        }
        if(predictionIndex !== 2){
        progressCallback(75, "Running segmentation...");
        await new Promise(resolve => requestAnimationFrame(resolve));

        const result = await runSegmenter(input);
        cropInfo = result.crop;
        progressCallback(100, "Inference complete.");

        console.log(
            "Segmentation output:",
            result.mask.dims,
            result.mask.data.length
        );


        tumorArea =
            analyzeMask(
                result.mask.data
            );


        const segmentationOutput =
            document.getElementById(
                "segmentationOutput"
            );


        // Clear old result
        segmentationOutput.innerHTML = `

        <h3>Segmentation Result</h3>

        <p>
        Tumor Pixel Area with respect to the image:
        <b>${tumorArea}%</b>
        </p>
        <p>Drag the dots to edit the mask</p>
        `;
    container.innerHTML=""
    container.style.display = 'flex';
    container.style.flexDirection = 'row'; // Rows align items horizontally
    container.style.gap = '10px';          // Adds clean spacing between buttons


    const dotButton = document.createElement('button');
        dotButton.id = 'dots';
        dotButton.type = 'button';
        dotButton.className = 'pushable';
        const dotSpan = document.createElement('span')
        dotSpan.textContent = 'Turn off Dots';
        dotSpan.className = 'front';
        dotButton.appendChild(dotSpan)
        dotButton.addEventListener('click', () => {dotVisibility++;
            switchButtonClicks++;
            if (switchButtonClicks%2 === 0){
            dotSpan.textContent = 'Turn off Dots';
        }
        else{dotSpan.textContent = 'Turn on Dots';}
            redrawMask(lastOriginalCanvas);});
    const undoButton = document.createElement('button');
    undoButton.id = 'undo';
    undoButton.type = 'button';
    undoButton.className = 'pushable';
    const undoSpan = document.createElement('span')
    undoSpan.textContent = 'Undo Edit';
    undoSpan.className = 'front';
    undoButton.appendChild(undoSpan)
    undoButton.addEventListener(
    'click',
    undoEdit
);
    const exportButton = document.createElement('button');
    exportButton.id = 'export';
    exportButton.type = 'button';
    exportButton.className = 'pushable';
    const exportSpan = document.createElement('span')
    exportSpan.textContent = 'Export as binary mask';
    exportSpan.className = 'front';
    exportButton.appendChild(exportSpan)
    exportButton.addEventListener("click", () => {
    exportCanvasAsImage();
});
    container.appendChild(dotButton);
    container.appendChild(undoButton);
    container.appendChild(exportButton)
    const slider = document.createElement('div');
    const sliderInput = document.createElement('input')
    sliderInput.type = 'range';
    sliderInput.min = 0;
    sliderInput.max = 1;
    sliderInput.step = 0.05;

    sliderInput.value = 0.2;
    sliderInput.className = 'numeric-slider'

    const valueDisplay = document.createElement('p');
    valueDisplay.innerHTML = `Value: <strong>${sliderInput.value}</strong>`;

    sliderInput.addEventListener('input', (event) => {
    valueDisplay.innerHTML = `Value: <strong>${event.target.value}</strong>`;
    maskOpacity = event.target.value;
    redrawMask(lastOriginalCanvas);
    });

    slider.appendChild(sliderInput);
    slider.appendChild(valueDisplay);
    document.body.appendChild(slider);
    if (numImageInput < 2 && predictionIndex !== 2){    
    document.body.appendChild(container);
}

        // Add canvas
        const segmentationCanvas =
    displayMask(
        result.mask.data,
        result.originalCanvas, result.crop
    );
    }
    else{
        const segmentationOutput =
            document.getElementById(
                "segmentationOutput"
            );


        // Clear old result
        segmentationOutput.innerHTML = 'No tumor detected'
    }
    progressCallback(100, "Inference complete.");

    return {
    prediction,
    predictionIndex,
    scores,
    probabilities,
    tumorArea,
    canvas: segmentationCanvas
};
}

    catch(error){

        console.error(
            "MRI analysis failed:",
            error
        );

    }


    finally {

        loader.style.display = "none";
        bar.style.animation = "none";
    }
}

// Load models when page starts

modelsReady = loadModels();

window.analyzeMRI = analyzeMRI;
window.getFileName = getFileName;