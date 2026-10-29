# ProtoFusion

**Protocol-Guided Prompt Refinement for Generative Infrared and Visible Image Fusion**

Pengwei Liang, Junjun Jiang, and Junhui Hou.

[Project page](https://erfect2020.github.io/ProtoFusion/)

This repository hosts the ProtoFusion research project page. It presents paired visible/infrared inputs and fusion results, a short visual introduction, linked detail inspection, protocol refinement examples, source-consistency correction, and benchmark results.

The paper and research code are coming soon. This repository currently contains the project website.

## Deployment

GitHub Pages serves the root of the `main` branch. All asset paths are relative, so the page also works under the `/ProtoFusion/` repository path.

## Scientific content

Displayed results and figures follow the ProtoFusion manuscript updated on 28 October 2026. `sources.json` records the source figure, SHA-256 hash, extraction details and numerical table labels. The video is an animated presentation of still-image evidence, with crop provenance recorded in `assets/film-provenance.json`.

The page includes eight VIS-only / shuffled-IR / paired-IR comparisons, the revised refinement-budget study, a VLM-optimized Prompt baseline, and CE / Q_AB/F / VIF results for 13 methods. All numerical tables are extracted directly into `data.js`; metric rankings and summary values are computed from that data.

Scientific images preserve their original proportions and annotations. Main benchmark results use PGPR + SBC; budget and component studies use base PGPR. Displayed candidate numbers indicate presentation order, not optimization rounds. The manuscript source files and PDF are not included in this website repository.

The preparation scripts are included for the authors' asset workflow and require the matching manuscript figure files. Viewing or hosting the page uses the prebuilt assets and does not require those scripts.


