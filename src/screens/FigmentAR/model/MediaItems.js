/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 */
import * as LoadingConstants from '../redux/LoadingStateConstants';

const MediaItems = [
    {
        "name": "sample_video",
        "selected": false,
        "loading": LoadingConstants.NONE,
        "icon_img": require("../../../../assets/adaptive-icon.png"), // Placeholder icon
        "source": { uri: "https://www.w3schools.com/html/mov_bbb.mp4" }, // Remote sample
        "type": "VIDEO",
        "scale": [1, 1, 1],
        "position": [0, 0, -1],
        "width": 1,
        "height": 1,
        "loop": true,
        "materials": null, // Can add chroma key material here if needed
        "resources": []
    },
    {
        "name": "logo_image",
        "selected": false,
        "loading": LoadingConstants.NONE,
        "icon_img": require("../../../../assets/icon.png"),
        "source": require("../../../../assets/icon.png"),
        "type": "IMAGE",
        "scale": [1, 1, 1],
        "position": [0, 0, -1],
        "width": 0.5,
        "height": 0.5,
        "resources": []
    }
];

module.exports = {
    getMediaArray: function () {
        return MediaItems;
    }
};
