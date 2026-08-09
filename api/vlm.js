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
            tumorArea
        } = req.body;

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

        const response =
            await groq.chat.completions.create({

                model: "llama-3.3-70b-versatile",

                messages: [
                    {
                        role: "user",

                        content: `
Explain these brain MRI model results
in clear, non-diagnostic language.

Prediction:
${prediction}

Probabilities:
${probabilityText}

Estimated tumor area:
${tumorArea}%

This is not a medical diagnosis.
                        `
                    }
                ]
            });

        return res.status(200).json({
            result: response.choices[0].message.content
        });

    } catch (error) {

        console.error("Groq error:", error);

        return res.status(500).json({
            error: "VLM request failed"
        });
    }
}