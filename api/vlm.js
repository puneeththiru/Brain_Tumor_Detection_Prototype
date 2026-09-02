import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export default async function handler(req, res) {

    console.log("VLM endpoint reached!");

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const {
            prediction,
            probabilities,
            tumorArea,
            image
        } = req.body;

        if (!prediction || !probabilities || tumorArea === undefined) {
            return res.status(400).json({
                error: "Missing prediction, probabilities, or tumor area"
            });
        }
        
        if (!image) {
            return res.status(400).json({
                error: "Missing MRI image"
            });
        }

        const classes = [
            "glioma",
            "meningioma",
            "no_tumor",
            "pituitary"
        ];

        const probabilityText = probabilities
            .map((x, i) =>
                `${classes[i]}: ${(x * 100).toFixed(2)}%`
            )
            .join("\n");

        const prompt = `
Analyze the provided brain MRI image and the accompanying machine-learning results.

Return ONLY the final answer that should be shown to the user.

DO NOT:
- Describe your reasoning process.
- Describe how you are constructing the answer.
- Mention "the user wants..."
- Mention "drafting", "planning", "refining", "self-correction", or "instructions".
- Repeat or discuss these instructions.
- Write an internal analysis before the answer.
- Claim that the patient has a tumor or has a specific disease.
- Present the AI output as a medical diagnosis.

The response should be concise, objective, and easy to understand.

Use exactly these sections:

**Image Observation**
Briefly describe what is visibly present in the MRI. If a red region is present, identify it as the segmentation mask rather than claiming it is definitively a tumor.

**Model Prediction**
State the classification model's prediction.

**Classification Probabilities**
List the probabilities provided by the classification model.

**Segmentation Result**
Explain the estimated tumor/segmentation area,
describe the shape and characteristics of the tumor from the mask and classification prediction, and finally,
describe the location of the segmented region with respect to the brain scan
based only on what is visible in the image and segmentation mask.

**Consistency**
Briefly explain whether the segmentation result appears broadly consistent with the classification prediction. Make clear that this is an automated model result, not a diagnosis.

**Limitations**
Briefly state that the system is an experimental research prototype and that the results require evaluation by a qualified medical professional.

*Decision*
State a reasonable decision or outcome that is only meant to be taken seriously under a medical expert
Model prediction:
${prediction}

Classification probabilities:
${probabilityText}

Estimated segmented area:
${tumorArea}% of the image.

Remember:
Return ONLY the final user-facing answer. Do not include analysis, reasoning, planning, drafting, or commentary.
`;

        const response =
            await groq.chat.completions.create({

                model: "qwen/qwen3.8-27b",

                messages: [

                    {
                        role: "system",

                        content:
                            "You are an AI assistant for an experimental brain MRI research prototype. Your output must be non-diagnostic and must not be presented as a medical diagnosis."
                    },

                    {
                        role: "user",

                        content: [

                            {
                                type: "text",
                                text: prompt
                            },

                            {
                                type: "image_url",

                                image_url: {
                                    url: image
                                }
                            }

                        ]
                    }

                ],
                reasoning_effort: "none",
                reasoning_format: "hidden",
                temperature: 0.2,

                max_completion_tokens: 800

            });

        return res.status(200).json({

            result:
                response.choices[0].message.content

        });

    } catch (error) {

        console.error("Groq error:", error);

        return res.status(500).json({
            error: "VLM request failed",
            details: error.message
        });
    }
}