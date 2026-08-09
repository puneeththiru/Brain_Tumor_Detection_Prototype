require("dotenv").config();

const express = require("express");
const path = require("path");
const Groq = require("groq-sdk");

const app = express();

app.use(express.json({ limit: "20mb" }));

app.use(express.static(path.join(__dirname, ".")));

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/vlm", async (req, res) => {

    console.log("VLM endpoint reached!");

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

                        This is not a medical diagnosis.`
                    }
                ]
            });

        res.json({
            result:
                response.choices[0].message.content
        });

    } catch (error) {

        console.error("Groq error:", error);

        res.status(500).json({
            error: "VLM request failed"
        });

    }
});

app.listen(3000, () => {
    console.log(
        "Server running at http://127.0.0.1:3000"
    );
});