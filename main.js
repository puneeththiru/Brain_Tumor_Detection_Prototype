let classifierSession;
let segmenterSession;
let editableMask = null;
let segmentationCanvas = null;
let segmentationCtx = null;
let painting = false;
let brushRadius = 8;
let eraseMode = false;
let lastOriginalCanvas = null;

let cropInfo = null;
const classes = [
    "glioma",
    "meningioma",
    "no_tumor",
    "pituitary"
];
function redrawMask(originalCanvas){

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


    for(let i=0;i<editableMask.length;i++){

        if(editableMask[i]){

            image.data[i*4]=255;
            image.data[i*4+1]=0;
            image.data[i*4+2]=0;
            image.data[i*4+3]=150;

        }

    }


    segmentationCtx.putImageData(
        image,
        0,
        0
    );
}
function paintMask(e){

    if(!painting) return;

    const rect =
        segmentationCanvas.getBoundingClientRect();

    // Mouse position on displayed image
    const displayX =
        (e.clientX - rect.left) *
        512 / rect.width;

    const displayY =
        (e.clientY - rect.top) *
        512 / rect.height;

    // Crop rectangle on displayed image
    const cropDisplayX =
        cropInfo.x * 512 / lastOriginalCanvas.width;

    const cropDisplayY =
        cropInfo.y * 512 / lastOriginalCanvas.height;

    const cropDisplayWidth =
        cropInfo.width * 512 / lastOriginalCanvas.width;

    const cropDisplayHeight =
        cropInfo.height * 512 / lastOriginalCanvas.height;

    // Ignore clicks outside crop
    if(
        displayX < cropDisplayX ||
        displayX > cropDisplayX + cropDisplayWidth ||
        displayY < cropDisplayY ||
        displayY > cropDisplayY + cropDisplayHeight
    ){
        return;
    }

    // Convert back to mask coordinates
    const centerX =
        Math.floor(
            (displayX - cropDisplayX) *
            512 / cropDisplayWidth
        );

    const centerY =
        Math.floor(
            (displayY - cropDisplayY) *
            512 / cropDisplayHeight
        );

    for(let dy=-brushRadius; dy<=brushRadius; dy++){

        for(let dx=-brushRadius; dx<=brushRadius; dx++){

            if(dx*dx + dy*dy > brushRadius*brushRadius)
                continue;

            const xx = centerX + dx;
            const yy = centerY + dy;

            if(
                xx < 0 ||
                yy < 0 ||
                xx >= 512 ||
                yy >= 512
            ) continue;

            editableMask[yy*512 + xx] =
                eraseMode ? 0 : 1;

        }

    }

    redrawMask(lastOriginalCanvas);

}
function displayMask(
    maskData,
    originalCanvas,
    crop
){

    const canvas =
        document.createElement("canvas");

    canvas.width=512;
    canvas.height=512;

    const ctx =
        canvas.getContext("2d");

    segmentationCanvas = canvas;
    segmentationCtx = ctx;

    lastOriginalCanvas =
        originalCanvas;

    cropInfo = crop;

    editableMask =
        new Uint8Array(maskData.length);

    for(let i=0;i<maskData.length;i++){

        const probability =
            1/(1+Math.exp(-maskData[i]));

        editableMask[i] =
            probability>0.5 ? 1 : 0;

    }

    redrawMask(originalCanvas);

    canvas.addEventListener(
        "mousedown",
        ()=>painting=true
    );

    canvas.addEventListener(
        "mouseup",
        ()=>painting=false
    );

    canvas.addEventListener(
        "mouseleave",
        ()=>painting=false
    );

    canvas.addEventListener(
        "mousemove",
        paintMask
    );

    const output =
        document.getElementById(
            "segmentationOutput"
        );

    output.innerHTML =
`
<h3>Segmentation Result</h3>
`;

    output.appendChild(canvas);

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


    const percentage =
        (tumorPixels / mask.length)*100;


    return percentage.toFixed(2);

}
// Load both models
async function loadModels() {

    classifierSession =
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

async function runClassifier(img) {

    const input =
        await imageToTensor(img);


    const feeds = {};

    feeds[
        classifierSession.inputNames[0]
    ] = input.tensor;


    const results =
        await classifierSession.run(feeds);


    return results[
        classifierSession.outputNames[0]
    ];

}



// ==========================
// SEGMENTATION
// ==========================

async function runSegmenter(img){

    const input =
        await imageToTensor(img);

    const feeds = {};

    feeds[
        segmenterSession.inputNames[0]
    ] = input.tensor;

    const results =
        await segmenterSession.run(feeds);

    return {

        mask:
            results[
                segmenterSession.outputNames[0]
            ],

        displayCanvas:
    input.displayCanvas,

crop:
    input.crop

    };

}



// Example usage

async function analyzeMRI(img) {
console.log("Starting inference");

    const loader =
        document.getElementById("loading-screen");


    loader.style.display = "flex";


    // Force browser to render loader
    await new Promise(resolve =>
        requestAnimationFrame(resolve)
    );

    try {

    const classification =
    await runClassifier(img);


const scores = Array.from(classification.data);
const probabilities = softmax(scores);


const predictionIndex =
    scores.indexOf(
        Math.max(...scores)
    );


const classes = [
    "glioma",
    "meningioma",
    "no_tumor",
    "pituitary"
];


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
${scores.map(
    (x,i)=>classes[i]+": "+x.toFixed(4)
).join("<br>")}
</p>

<p>
Softmax Probabilities(Classification Confidence):
<br>
${probabilities.map(
    (x,i)=>classes[i]+": "+(x*100).toFixed(2)+"%"
).join("<br>")}
</p>

`;



    // Segmentation
const result = await runSegmenter(img);

const tumorArea =
    analyzeMask(result.mask.data);

document.getElementById(
    "segmentationOutput"
).innerHTML = `
<h3>Segmentation Result</h3>

<p>
Tumor Pixel Area:
${tumorArea}%
</p>
`;

displayMask(
    result.mask.data,
    result.displayCanvas,
    result.crop
);
    }
    finally {

        loader.style.display = "none";

    }

}


// Load models when page starts

loadModels();
window.analyzeMRI = analyzeMRI;