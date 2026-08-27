## BTDectection

A Multimodal Website for Brain Tumor Detection, Analysis, and Interpretation via Three Machine Learning Models

> **Disclaimer:** This project is intended for educational, research, and annotation-assistance purposes only. It is not a medical device and should not be used to diagnose, treat, or make clinical decisions about patients.
>
The latest version of the website is here: https://brain-tumor-detection-prototype.vercel.app
This version of the site includes VLM diagnostics.

The github pages version is here: https://puneeththiru.github.io/Brain_Tumor_Detection_Prototype/
This version of the site doesn't include VLM diagnostics, but you will still have access to classifier and segmentation results. VLM inference requires a backend not available via static github pages hosting.
## Demonstration

https://www.youtube.com/watch?v=WOtwsYzAgY8

## Overview

This project provides a browser-based interface for analyzing brain MRI scans using multiple AI components.

The application currently supports:

- 2D MRI image classification (`.jpeg`/`.png`)
- Brain tumor segmentation
- Interactive segmentation-mask editing
- Tumor pixel-area estimation
- AI-generated explanations using a vision-language model (VLM)
- NIFTI (`.nii` / `.nii.gz`) volume visualization
- Axial, coronal, and sagittal views
- NIFTI slice navigation
- Browser-based MRI visualization
- Planned DICOM → NIFTI conversion

The goal is to combine traditional computer vision models with a vision-language model to create a more informative MRI analysis workflow.

Model 1: Classifier for glioma, meningioma, and pituitary tumors
Model 2: Segmentation model for single slice imaging
Model 3: Vision-Language model for analysis after classifier and segmentation inference

## Model 1
An efficientnet-b3 classifier

Gives predictions and confidence

## Model 2
An efficientnet-b3 segmentation model

Gives localized tumor regions on single slices, but it's also used for slices in nifti viewing

Users can edit the segmentation results and export as a binary mask

## Model 3
Qwen Vision Language Model

**Understand that this model provides further explanation and NOT the truth**

Uses classifier and segmentation results to provide further analysis on the prediction tumor including:
- Tumor location with respect to the MRI image
- Consistency review between classifier and segmentation model

## Limitations and Purpose
The purpose is aid radiologists, students, or individuals in gaining more knowledge about an MRI scan. This could help to quicken information gathering and function. However, the models were only tested on BRISC2025 T1 images and the segmentation model used for NIFTI viewing is not a distinct 3D-Unet. The VLM is not fine-tuned via code, but rather uses a prompt.

The following prompt is used for the VLM:
> **Where:**  the inputs are the classification prediction, the softmax confidence as a probabiltiy, the tumor area with respect to the image(not the MRI itself), and the segmentation mask overlaid on the image.
>
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
${tumorArea} of the image.

Remember:
Return ONLY the final user-facing answer. Do not include analysis, reasoning, planning, drafting, or commentary.

## Transparency and Citations

All data used to develop the two client-side models comes from BRISC2025:

Fateh, A., Rezvani, Y., Moayedi, S. et al. BRISC: Annotated Dataset for Brain Tumor Segmentation and Classification. Sci Data 13, 361 (2026). https://doi.org/10.1038/s41597-026-06753-y

Website design was insipred by: https://github.com/MiladiCode/3D-startup-app

The DICOM to NIFTI Converter is from: https://niivue.github.io/niivue-dcm2niix/

The segmentation model's metrics on the 20th epoch:

Train Loss : 0.0696

Train Dice : 0.9422

Val Loss   : 0.1618

Val Dice   : 0.8707

IoU        : 0.8031

Precision  : 0.8935

Recall     : 0.8931

The classification model is going under further evaluation due to potential dataset leakage from the dataset's main aggregated sources.

## NIFTI Viewing
Clicking the tab for NIFTI Viewing allows the user to view the nifti file in all three anatomical planes. The user can run segmentation inference on a single image at a time. This was trained on glioma, meningioma, and pituitary tumors.

## Special Thanks
I'd like to thank Mr. Yasin Rezvani for play testing and giving feedback for the website. He has significantly contributed to the development of the website. I'd also like to thank others like Dr. Jason Johnson, Dr. Mantej Singh, and Mr. Zachary Yaninek for giving feedback for the website from a clinical perspective. They have helped the website to be geared more towards clinical use, but further development needs to occur before it can be used in clinical practice.
