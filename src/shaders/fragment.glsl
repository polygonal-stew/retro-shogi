#version 300 es

precision mediump float;

uniform bool uClicked;
uniform sampler2D sTexture;
uniform sampler2D sGrid;

in vec2 vTexCoord;
out vec4 oFragColor;

void main() {
    if (uClicked) {
        oFragColor = texture(sGrid, vTexCoord);
    } else {
        oFragColor = texture(sTexture, vTexCoord);
    }

    if (oFragColor.a < 0.5) {
        discard;
    }
}