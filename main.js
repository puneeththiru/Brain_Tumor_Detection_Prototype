let classifierSession;
let segmenterSession;
let editableMask = null;
let segmentationCanvas = null;
let segmentationCtx = null;
let lastOriginalCanvas = null;

let cropInfo = null;
let modelsReady;
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;

let maskOffsetX = 0;
let maskOffsetY = 0;
const classes = [
    "glioma",
    "meningioma",
    "no_tumor",
    "pituitary"
];
function redrawMask(originalCanvas){

    if(!segmentationCtx || !editableMask)
        return;


    segmentationCtx.clearRect(
        0,
        0,
        512,
        512
    );


    segmentationCtx.drawImage(
        originalCanvas,
        0,
        0,
        512,
        512
    );


    const image =
        segmentationCtx.getImageData(
            0,
            0,
            512,
            512
        );


    for(let y=0;y<512;y++){

    for(let x=0;x<512;x++){


        const srcX =
            x - maskOffsetX;


        const srcY =
            y - maskOffsetY;


        if(
            srcX < 0 ||
            srcY < 0 ||
            srcX >= 512 ||
            srcY >= 512
        )
            continue;



        const index =
            Math.floor(srcY)*512 +
            Math.floor(srcX);



        if(editableMask[index] === 1){

            const pixel =
                (y*512+x)*4;


            image.data[pixel] = 255;
            image.data[pixel+1] = 0;
            image.data[pixel+2] = 0;
            image.data[pixel+3] = 120;

        }

    }

}


    segmentationCtx.putImageData(
        image,
        0,
        0
    );

}
function startDrag(e){

    dragging = true;


    dragStartX =
        e.clientX;

    dragStartY =
        e.clientY;

}


function dragMask(e){

    if(!dragging)
        return;


    const dx =
        e.clientX - dragStartX;

    const dy =
        e.clientY - dragStartY;


    maskOffsetX += dx;
    maskOffsetY += dy;


    dragStartX =
        e.clientX;

    dragStartY =
        e.clientY;


    redrawMask(
        lastOriginalCanvas
    );

}


function endDrag(){

    dragging = false;

}
function displayMask(
    maskData,
    originalCanvas
){

    console.log(
        "Displaying segmentation:",
        maskData.length
    );


    const canvas =
        document.createElement("canvas");


    canvas.width = 512;
    canvas.height = 512;


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


        // Lower threshold because model outputs logits
        if(probability > 0.5){

            editableMask[i]=1;
            tumorPixels++;

        }

    }


    console.log(
        "Predicted tumor pixels:",
        tumorPixels
    );



    redrawMask(
        originalCanvas
    );



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

const displayCanvas = document.createElement("canvas");

displayCanvas.width = 512;
displayCanvas.height = 512;

const displayCtx = displayCanvas.getContext("2d");

displayCtx.drawImage(
    imageElement,
    cropped.x,
    cropped.y,
    cropped.width,
    cropped.height,
    0,
    0,
    512,
    512
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

    displayCanvas,

    crop: displayCrop

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

        mask:
            results[
                segmenterSession.outputNames[0]
            ],

        displayCanvas:
    imgTensor.displayCanvas,

crop:
    imgTensor.crop

    };

}



// Example usage

async function analyzeMRI(img) {
    await modelsReady;
    
    console.log("Starting inference");
    

    const loader =
        document.getElementById("loading-screen");


    loader.style.display = "flex";


    await new Promise(resolve =>
        requestAnimationFrame(resolve)
    );


    try {
        const input = await imageToTensor(img);

        // =====================
        // CLASSIFICATION
        // =====================

        const classification =
            await runClassifier(input);


        const scores =
            Array.from(classification.data);


        const probabilities =
            softmax(scores);


        const predictionIndex =
            scores.indexOf(
                Math.max(...scores)
            );


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

        const result =
            await runSegmenter(input);



        console.log(
            "Segmentation output:",
            result.mask.dims,
            result.mask.data.length
        );


        const tumorArea =
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
        Tumor Pixel Area:
        <b>${tumorArea}%</b>
        </p>

        `;


        // Add canvas
        displayMask(
            result.mask.data,
            result.displayCanvas
        );


    }


    catch(error){

        console.error(
            "MRI analysis failed:",
            error
        );

    }


    finally {

        loader.style.display = "none";

    }

}
//Dicom section
const dicomInput =
    document.getElementById("dicomUpload");

const uploadButton =
    document.getElementById("uploadDicomButton");

uploadButton.addEventListener(
    "click",
    () => dicomInput.click()
);

dicomInput.addEventListener(
    "change",
    loadDicomSeries
);
async function loadDicomSeries(event){

    const files =
        Array.from(event.target.files);

    if(files.length === 0)
        return;

    document.getElementById(
        "dicomStatus"
    ).innerHTML =
        `Loading ${files.length} DICOM files...`;

    // Sort alphabetically for now.
    // Later this will be replaced with sorting
    // using DICOM metadata.
    files.sort((a,b)=>
        a.name.localeCompare(b.name)
    );

    console.log(
        "Loaded DICOM files:",
        files.length
    );

    console.log(files);

    // Store for reconstruction later
    window.currentDicomSeries =
        files;

    document.getElementById(
        "dicomStatus"
    ).innerHTML =
        `${files.length} slices loaded.`;
}
// Load models when page starts

modelsReady = loadModels();

window.analyzeMRI = analyzeMRI;