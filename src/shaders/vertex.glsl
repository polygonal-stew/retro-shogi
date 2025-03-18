#version 300 es

uniform mat4 uMatrix;
uniform mat4 uTextureMatrix;

layout(location = 0) in vec4 aPosition;
layout(location = 1) in vec2 aTexCoord;

out vec2 vTexCoord;

void main() {
    vTexCoord = (uTextureMatrix * vec4(aTexCoord, 0.0, 1.0)).xy;
    gl_Position = uMatrix * aPosition;
}
