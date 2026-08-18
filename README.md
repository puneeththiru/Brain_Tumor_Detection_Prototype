## BTDectection

A Multimodal Website for Brain Tumor Detection, Analysis, and Interpretation via Three Machine Learning Models

> **Disclaimer:** This project is intended for educational, research, and annotation-assistance purposes only. It is not a medical device and should not be used to diagnose, treat, or make clinical decisions about patients.
The lastest version of the website is here: ([https://brain-tumor-detection-prototype-giq5t1za4-puneethen.vercel.app/](https://brain-tumor-detection-prototype.vercel.app/))
This version of the site includes vlm diagnostics.
The github pages version is here: https://puneeththiru.github.io/Brain_Tumor_Detection_Prototype/
This version of the site doesn't include vlm diagnostics, but you will still have access to classifier and segmentation results.
## Overview

This project provides a browser-based interface for analyzing brain MRI scans using multiple AI components.

The application currently supports:

- 2D MRI image classification (`.jpeg`/`.png`)
- Brain tumor segmentation
- Interactive segmentation-mask editing
- Tumor pixel-area estimation
- AI-generated explanations using a vision-language model (VLM)
- NIfTI (`.nii` / `.nii.gz`) volume visualization
- Axial, coronal, and sagittal views
- NIfTI slice navigation
- Browser-based MRI visualization
- Planned DICOM → NIfTI conversion

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
Uses classifier and segmentation results to provide further analysis on the prediction tumor including:
- Tumor location with respect to the MRI image
- Consistency review between classifier and segmentation model
- Suggested course of action

## NIFTI Viewing
Clicking the tab for NIFTI Viewing allows the user to view the nifti file in all three anatomical planes. The user can run segmentation inference on a single image at a time. This was trained on glioma, meningioma, and pituitary tumors.


