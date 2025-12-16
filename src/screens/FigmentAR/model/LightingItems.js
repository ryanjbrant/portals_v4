/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 */
import * as LoadingConstants from '../redux/LoadingStateConstants';

// HDRI sources for lighting environment
const HDRI_SOURCES = {
    'studio-09': { uri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr' },
    'studio-08': { uri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr' },
    'studio-05': { uri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_05_1k.hdr' },
    'studio-03': { uri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr' },
    'studio-02': { uri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_02_1k.hdr' },
    'cyclorama': { uri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cyclorama_hard_light_1k.hdr' },
};

// List items for the picker
const LightingItems = [
    {
        "name": "studio-09",
        "icon_img": require("../../../../assets/hdri/SoftboxStudio.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-08",
        "icon_img": require("../../../../assets/hdri/StudioGlow.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-05",
        "icon_img": require("../../../../assets/hdri/TwoGlows.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-03",
        "icon_img": require("../../../../assets/hdri/Stripes.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-02",
        "icon_img": require("../../../../assets/hdri/windowStudio.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "cyclorama",
        "icon_img": require("../../../../assets/hdri/LightTentReflection.jpg"),
        "loading": LoadingConstants.NONE,
    }
];

module.exports = {
    getLightingArray: function () {
        return LightingItems;
    },
    getHDRISource: function (name) {
        return HDRI_SOURCES[name];
    }
};
