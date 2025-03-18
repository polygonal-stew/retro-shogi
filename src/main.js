import './style.css';

import vertexSource from './shaders/vertex.glsl?raw';
import fragmentSource from './shaders/fragment.glsl?raw';

import * as _ from 'lodash';
import { mat4 } from 'gl-matrix';

const Movement = {
    Forward: 1,
    ForwardLine: 2,
    Orthogonal: 4,
    OrthogonalLine: 8,
    Diagonal: 16,
    DiagonalLine: 32,
    DiagonalForward: 64,
    Jump: 128
};

const Side = {
    Black: 1,
    White: 2
};

const PieceKind = {
    King: 'King',
    Rook: 'Rook',
    Bishop: 'Bishop',
    GoldGeneral: 'Gold General',
    SilverGeneral: 'Silver General',
    Knight: 'Knight',
    Lance: 'Lance',
    Pawn: 'Pawn'
};

class Piece {
    constructor(kind, side, file, rank, board) {
        this.kind = kind;
        this.side = side;
        this.file = file;
        this.rank = rank;
        this.board = board;
        this.promoted = false;
    }

    getMovements() {
        return {
            [PieceKind.King]: () => Movement.Orthogonal | Movement.Diagonal,
            [PieceKind.Rook]: (promoted) => {
                return !promoted ? Movement.OrthogonalLine :
                    Movement.OrthogonalLine | Movement.Diagonal;
            },
            [PieceKind.Bishop]: (promoted) => {
                return !promoted ? Movement.DiagonalLine :
                    Movement.Orthogonal | Movement.DiagonalLine;
            },
            [PieceKind.GoldGeneral]: () => Movement.Orthogonal | Movement.DiagonalForward,
            [PieceKind.SilverGeneral]: (promoted) => {
                return !promoted ? Movement.Forward | Movement.Diagonal :
                    Movement.Orthogonal | Movement.DiagonalForward;
            },
            [PieceKind.Knight]: (promoted) => {
                return !promoted ? Movement.Jump :
                    Movement.Orthogonal | Movement.DiagonalForward;
            },
            [PieceKind.Lance]: (promoted) => {
                return !promoted ? Movement.ForwardLine :
                    Movement.Orthogonal | Movement.DiagonalForward;
            },
            [PieceKind.Pawn]: (promoted) => {
                return !promoted ? Movement.Forward :
                    Movement.Orthogonal | Movement.DiagonalForward;
            }
        }[this.kind](this.promoted);
    }

    facingDown() {
        return this.side == Side.White;
    }

    moveTo(file, rank) {
        const previousRank = this.rank;
        this.file = file;
        this.rank = rank;

        if (this.promoted) {
            return;
        }

        if (_.includes([PieceKind.Pawn, PieceKind.Lance], this.kind)) {
            if ((this.facingDown() && this.rank == 9) || (!this.facingDown() && this.rank == 1)) {
                this.promote();
                return;
            }
        } else if (this.kind == PieceKind.Knight) {
            if ((this.facingDown() && this.rank >= 8) || (!this.facingDown() && this.rank <= 2)) {
                this.promote();
                return;
            }
        }
        if (this.canPromote()) {
            for (const rank of [this.rank, previousRank]) {
                if ((this.facingDown() && rank >= 7) || (!this.facingDown() && rank <= 3)) {
                    if (confirm('Promote this piece?')) {
                        this.promote();
                        return;
                    }
                }
            }
        }
    }

    canMoveTo(file, rank) {
        if (file < 1 || file > 9 || rank < 1 || rank > 9) {
            return false;
        }

        let matchingMoves = 0;
        const fileDifference = this.file - file;
        const rankDifference = (this.facingDown() ? (rank - this.rank) : (this.rank - rank));

        if (fileDifference == 0 && rankDifference == 1) {
            matchingMoves |= Movement.Forward;
        }
        if (fileDifference == 0 && rankDifference > 0) {
            matchingMoves |= Movement.ForwardLine;
        }
        if (Math.abs(fileDifference) + Math.abs(rankDifference) == 1) {
            matchingMoves |= Movement.Orthogonal;
        }
        if (fileDifference == 0 || rankDifference == 0) {
            matchingMoves |= Movement.OrthogonalLine;
        }
        if (Math.abs(fileDifference) == 1 && Math.abs(rankDifference) == 1) {
            matchingMoves |= Movement.Diagonal;
        }
        if (Math.abs(fileDifference) == Math.abs(rankDifference)) {
            matchingMoves |= Movement.DiagonalLine;
        }
        if (Math.abs(fileDifference) == 1 && rankDifference == 1) {
            matchingMoves |= Movement.DiagonalForward;
        }
        if (Math.abs(fileDifference) == 1 && rankDifference == 2) {
            matchingMoves |= Movement.Jump;
        }

        const possibleMoves = this.getMovements() & matchingMoves;
        if (!possibleMoves) {
            return false;
        }

        if (possibleMoves & (Movement.ForwardLine | Movement.OrthogonalLine)) {
            if (!rankDifference) {
                const adjustment = (fileDifference > 0 ? -1 : 1);
                for (let nextFile of _.range(this.file + adjustment, file)) {
                    const blockingPieces = this.board.piecesByProperty({
                        file: nextFile,
                        rank: rank,
                    });
                    if (blockingPieces.length) {
                        return false;
                    }
                }
            } else {
                const adjustment = ((rankDifference > 0) != this.facingDown() ? -1 : 1);
                for (let nextRank of _.range(this.rank + adjustment, rank)) {
                    const blockingPieces = this.board.piecesByProperty({
                        file: file,
                        rank: nextRank,
                    });
                    if (blockingPieces.length) {
                        return false;
                    }
                }
            }
        }
        if (possibleMoves & Movement.DiagonalLine) {
            const fileAdjustment = (fileDifference > 0 ? -1 : 1);
            const rankAdjustment = ((rankDifference > 0) != this.facingDown() ? -1 : 1);
            for (let [nextFile, nextRank] of _.zip(_.range(this.file + fileAdjustment, file), _.range(this.rank + rankAdjustment, rank))) {
                const blockingPieces = this.board.piecesByProperty({
                    file: nextFile,
                    rank: nextRank,
                });
                if (blockingPieces.length) {
                    return false;
                }
            }
        }

        const blockingPieces = this.board.piecesByProperty({
            file: file,
            rank: rank,
            side: this.side,
        });
        if (blockingPieces.length) {
            return false;
        }

        return true;
    }

    canMakeMove(file, rank) {
        if (!this.canMoveTo(file, rank)) {
            return false;
        }

        const originalFile = this.file;
        const originalRank = this.rank;
        this.moveTo(file, rank);
        const numberOfChecks = this.board.numberOfChecks(this.side);
        this.moveTo(originalFile, originalRank);

        return numberOfChecks == 0;
    }

    hasValidMove() {
        const forwardRankDelta = this.facingDown() ? 1 : -1;

        let hasMove = false;

        let movement = this.getMovements();
        if (movement & (Movement.Forward | Movement.ForwardLine)) {
            hasMove = hasMove || this.canMoveTo(this.file, this.rank + forwardRankDelta);
        }
        if (movement & (Movement.Orthogonal | Movement.OrthogonalLine)) {
            hasMove = hasMove || this.canMoveTo(this.file, this.rank + 1) || this.canMoveTo(this.file, this.rank - 1) || 
                this.canMoveTo(this.file + 1, this.rank) || this.canMoveTo(this.file - 1, this.rank);
        }
        if (movement & (Movement.Diagonal | Movement.DiagonalLine)) {
            hasMove = hasMove || this.canMoveTo(this.file + 1, this.rank + 1) || this.canMoveTo(this.file + 1, this.rank - 1) ||
                this.canMoveTo(this.file - 1, this.rank + 1) || this.canMoveTo(this.file - 1, this .rank - 1);
        }
        if (movement & Movement.DiagonalForward) {
            hasMove = hasMove || this.canMoveTo(this.file + 1, this.rank + forwardRankDelta) ||
                this.canMoveTo(this.file - 1, this.rank + forwardRankDelta);
        }
        if (movement & Movement.Jump) {
            const forwardTwo = this.rank + forwardRankDelta * 2;
            hasMove = hasMove || this.canMoveTo(this.file - 1, forwardTwo) || this.canMoveTo(this.file + 1, forwardTwo);
        }
        
        return hasMove;
    }

    matchesProperty(properties) {
        for (let property in properties) {
            if (this[property] != properties[property]) {
                return false;
            }
        }

        return true;
    }

    canPromote() {
        return !_.includes([PieceKind.King, PieceKind.GoldGeneral], this.kind);
    }

    promote() {
        this.promoted = true;
    }
}

class Board {
    constructor() {
        this.pieces = [];
    }

    loadDefault() {
        this.pieces = [
            new Piece(PieceKind.King, Side.White, 5, 1, this),
            new Piece(PieceKind.GoldGeneral, Side.White, 4, 1, this),
            new Piece(PieceKind.GoldGeneral, Side.White, 6, 1, this),
            new Piece(PieceKind.SilverGeneral, Side.White, 3, 1, this),
            new Piece(PieceKind.SilverGeneral, Side.White, 7, 1, this),
            new Piece(PieceKind.Knight, Side.White, 2, 1, this),
            new Piece(PieceKind.Knight, Side.White, 8, 1, this),
            new Piece(PieceKind.Lance, Side.White, 1, 1, this),
            new Piece(PieceKind.Lance, Side.White, 9, 1, this),
            new Piece(PieceKind.Rook, Side.White, 2, 2, this),
            new Piece(PieceKind.Bishop, Side.White, 8, 2, this),
            new Piece(PieceKind.King, Side.Black, 5, 9, this),
            new Piece(PieceKind.GoldGeneral, Side.Black, 4, 9, this),
            new Piece(PieceKind.GoldGeneral, Side.Black, 6, 9, this),
            new Piece(PieceKind.SilverGeneral, Side.Black, 3, 9, this),
            new Piece(PieceKind.SilverGeneral, Side.Black, 7, 9, this),
            new Piece(PieceKind.Knight, Side.Black, 2, 9, this),
            new Piece(PieceKind.Knight, Side.Black, 8, 9, this),
            new Piece(PieceKind.Lance, Side.Black, 1, 9, this),
            new Piece(PieceKind.Lance, Side.Black, 9, 9, this),
            new Piece(PieceKind.Rook, Side.Black, 8, 8, this),
            new Piece(PieceKind.Bishop, Side.Black, 2, 8, this)
        ];
        for (let file = 1; file <= 9; file++) {
            this.pieces.push(new Piece(PieceKind.Pawn, Side.White, file, 3, this));
            this.pieces.push(new Piece(PieceKind.Pawn, Side.Black, file, 7, this));
        }

        return this;
    }

    loadBoard(pieces) {
        this.pieces = pieces;

        return this;
    }

    piecesByProperty(properties) {
        return _.filter(this.pieces, (piece) => piece.matchesProperty(properties));
    }

    numberOfChecks(side) {
        const kings = this.piecesByProperty({
            kind: PieceKind.King,
            side: side,
        });

        if (!kings.length) {
            throw 'Invalid Board: Missing king';
        }

        const king = kings[0];

        const opposingSide = (side == Side.Black ? Side.White : Side.Black);

        const piecesChecking = this.piecesByProperty({
            side: opposingSide,
        }).filter((piece) => piece.canMoveTo(king.file, king.rank));

        return piecesChecking.length;
    }

    push(piece) {
        this.pieces.push(piece);
    }

    removeByProperty(properties) {
        this.pieces = this.pieces.filter((piece) => !piece.matchesProperty(properties));
    }

    movePiece(piece, file, rank, hand) {
        if (!piece.canMoveTo(file, rank)) {
            return false;
        }

        let opposingPieces = this.piecesByProperty({ file: file, rank: rank, side: piece.side == Side.Black ? Side.White : Side.Black });
        if (opposingPieces.length) {
            hand.capture(opposingPieces[0]);
            this.removeByProperty({ file: file, rank: rank });
        }
        piece.moveTo(file, rank);

        return true;
    }
}

class Hand {
    constructor(side) {
        this.side = side;
        this.pieces = [];
    }

    capture(piece) {
        this.pieces.push(piece.kind);
    }
}

class UserInterface {
    constructor() {
        var self = this;
        self.drawingBuffer = [];
        self.mousePosition = { x: -1, y: -1 };
        self.gridSelected = { x: -1, y: -1 };
        self.currentFrame = 0;
        self.loadAssets().then(function (assets) {
            self.initializeShader(assets)
        });
    }

    async loadAssets() {
        const files = await Promise.all([
            fetch('user_interface_texture.json').then(function (response) {
                return response.json();
            }),
            new Promise(function (resolve) {
                let image = new Image;
                image.onload = () => {
                    resolve(image);
                };
                image.src = 'user_interface_texture.png';
            }),
            new Promise(function (resolve) {
                let image = new Image;
                image.onload = () => {
                    resolve(image);
                };
                image.src = 'selection_grid.png';
            })
        ]);

        return {
            textureMetaInformation: files[0],
            texture: files[1],
            grid: files[2],
        };
    }

    initializeShader(assets) {
        var self = this;
        this.canvas = document.getElementById('webgl-canvas');

        setInterval(function () {
            self.currentFrame++;
        }, 500);

        const gl = this.canvas.getContext('webgl2');

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        const shaderProgram = this.initializeShaderProgram(gl, vertexSource, fragmentSource);

        const programInfo = {
            program: shaderProgram,
            attribLocations: {
                position: 0,
                texCoord: 1,
            },
            uniformLocations: {
                matrix: gl.getUniformLocation(shaderProgram, 'uMatrix'),
                textureMatrix: gl.getUniformLocation(shaderProgram, 'uTextureMatrix'),
                clicked: gl.getUniformLocation(shaderProgram, 'uClicked'),
                texture: gl.getUniformLocation(shaderProgram, 'sTexture'),
                grid: gl.getUniformLocation(shaderProgram, 'sGrid'),
            },
            texture: assets.texture,
            textureMetaInformation: assets.textureMetaInformation,
            grid: assets.grid,
        };

        const buffers = this.initializeBuffers(gl);

        const textures = this.loadTextures(gl, programInfo);

        this.drawScene(gl, programInfo, buffers, textures);
    }

    drawScene(gl, programInfo, buffers, textures) {
        let self = this;
        self.lastDrawTime = 0;

        const drawFrame = (time) => {
            time += 0.001;
            const deltaTime = time - self.lastDrawTime;

            if (deltaTime < 1.0 / 60.0) {
                requestAnimationFrame(drawFrame);
                return;
            }
            self.lastDrawTime = time;

            gl.useProgram(programInfo.program);
            
            gl.viewport(0, 0, 160, 144);

            gl.clearColor(0.0, 0.0, 0.0, 0.0);

            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.uniform1i(programInfo.uniformLocations.texture, 0);
            gl.uniform1i(programInfo.uniformLocations.grid, 1);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures.texture);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, textures.grid);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.position);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);

            let matrix = mat4.create();
            mat4.ortho(matrix, 0, 1, 0, 1, 0.1, 11);
            mat4.translate(matrix, matrix, [0, 0, -10]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.matrix, false, matrix);
            gl.uniformMatrix4fv(programInfo.uniformLocations.textureMatrix, false, mat4.create());
            gl.uniform1i(programInfo.uniformLocations.clicked, 1);
            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);

            let pixels = new Uint8Array(4);
            gl.readPixels(self.mousePosition.x, self.mousePosition.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            self.gridSelected = {
                x: Math.floor(pixels[0] / 10),
                y: Math.floor(pixels[1] / 10),
            };

            gl.uniform1i(programInfo.uniformLocations.clicked, 0);

            gl.clearColor(155.0 / 255.0, 188.0 / 255.0, 15.0 / 255.0, 1.0);

            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.clear(gl.COLOR_BUFFER_BIT);

            for (let command of self.drawingBuffer) {
                const position = command.position;

                const currentSprite = command.animation ? command.animation[self.currentFrame % command.animation.length] : command.sprite;
                const index = _.findIndex(programInfo.textureMetaInformation.sprites, function (sprite) {
                    return sprite == currentSprite;
                });
                let matrix = mat4.create();
                mat4.ortho(matrix, -position.x, 10 - position.x, position.y - 8, 1 + position.y, 0.1, 11);
                mat4.translate(matrix, matrix, [0, 0, -10]);
                mat4.translate(matrix, matrix, [0, 0, position.z]);
                if (command.flipped) {
                    mat4.rotate(matrix, matrix, Math.PI, [0, 0, 1]);
                    mat4.translate(matrix, matrix, [-1, -1, 0]);
                }
                gl.uniformMatrix4fv(programInfo.uniformLocations.matrix, false, matrix);

                let textureMatrix = mat4.create();
                mat4.scale(textureMatrix, textureMatrix, [0.125, 0.125, 1])
                mat4.translate(textureMatrix, textureMatrix, [index % 8, 7 - Math.floor(index / 8), 0]);
                gl.uniformMatrix4fv(programInfo.uniformLocations.textureMatrix, false, textureMatrix);

                gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
            }

            requestAnimationFrame(drawFrame);
        };

        requestAnimationFrame(drawFrame);
    }

    initializeBuffers(gl) {
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

        const positions = [
            0, 1,
            0, 0,
            1, 1,
            1, 0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

        const texCoords = [
            0, 1,
            0, 0,
            1, 1,
            1, 0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        const indices = [0, 1, 2, 3];
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return {
            vertexBuffer: vertexBuffer,
            texCoordBuffer: texCoordBuffer,
            indexBuffer: indexBuffer,
        };
    }

    initializeShaderProgram(gl, vertexSource, fragmentSource) {
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.log('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));

            return null;
        }

        return shaderProgram;
    }

    loadTextures(gl, programInfo) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 128, 128);

        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, programInfo.texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        const grid = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, grid);

        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 10, 9);

        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 10, 9, gl.RGBA, gl.UNSIGNED_BYTE, programInfo.grid);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        return {
            texture: texture,
            grid: grid,
        };
    }

    enableSelection(turn, board) {
        let self = this;
        self.selectionCallback = (event) => {
            let rect = event.target.getBoundingClientRect();
            self.mousePosition = {
                x: event.clientX - rect.left,
                y: rect.bottom - event.clientY,
            };

            self.removeDrawingCommandByProperty({ tag: 'selector' });

            if (self.gridSelected.x < 9) {
                self.drawingBuffer.push({
                    tag: 'selector',
                    sprite: 'board_selection',
                    position: {
                        x: self.gridSelected.x,
                        y: self.gridSelected.y,
                        z: 1,
                    },
                });
            } else if (self.gridSelected.y < 3) {
                self.drawingBuffer.push({
                    tag: 'selector',
                    position: {
                        x: self.gridSelected.x,
                        y: self.gridSelected.y,
                        z: 3,
                    },
                    animation: [
                        'select_hand_1',
                        'select_hand_2',
                    ],
                });
            }

            let pieces = board.piecesByProperty({ side: turn, file: self.gridSelected.x + 1, rank: self.gridSelected.y + 1 });

            if (pieces.length && pieces[0].hasValidMove()) {
                self.drawingBuffer.push({
                    tag: 'selector',
                    position: {
                        x: self.gridSelected.x,
                        y: self.gridSelected.y,
                        z: 3,
                    },
                    animation: [
                        'select_hand_1',
                        'select_hand_2',
                    ],
                })
            }
        };
        document.getElementById('webgl-canvas').addEventListener('mousemove', self.selectionCallback);
    }

    drawMovements(piece) {
        const drawingPosition = { x: piece.file - 1, y: piece.rank - 1, z: 2 };
        this.removeDrawingCommandByProperty({ tag: 'piece', position: drawingPosition });
        const spriteName = this.getSpriteForPiece(piece.kind);
        this.drawingBuffer.push({
            tag: 'piece',
            animation: [
                spriteName + '_walk_1',
                spriteName + '_walk_2',
            ],
            position: drawingPosition,
            flipped: piece.side == Side.Black,
        });
        for (let file = 1; file <= 9; file++) {
            for (let rank = 1; rank <= 9; rank++) {
                if (piece.canMoveTo(file, rank)) {
                    this.drawingBuffer.push({
                        tag: 'movement',
                        sprite: 'board_selection',
                        position: { x: file - 1, y: rank - 1, z: 1 },
                    })
                }
            }
        }

        let self = this;
        self.movementsCallback = (event) => {
            if (piece.canMoveTo(self.gridSelected.x + 1, self.gridSelected.y + 1)) {
                self.drawingBuffer.push({
                    tag: 'selector',
                    position: {
                        x: self.gridSelected.x,
                        y: self.gridSelected.y,
                        z: 3,
                    },
                    animation: [
                        'select_hand_1',
                        'select_hand_2',
                    ],
                })
            }
        };
        document.getElementById('webgl-canvas').addEventListener('mousemove', self.movementsCallback);
    }

    removeMovements(piece) {
        document.getElementById('webgl-canvas').removeEventListener('mousemove', this.movementsCallback);
        const position = {
            x: piece.file - 1,
            y: piece.rank - 1,
            z: 2,
        };
        this.removeDrawingCommandByProperty({ tag: 'movement' });
        this.removeDrawingCommandByProperty({ tag: 'selector' });
        this.removeDrawingCommandByProperty({ tag: 'piece', position: position });
        this.drawingBuffer.push({
            sprite: this.getSpriteForPiece(piece.kind),
            position: position,
            tag: 'piece',
            flipped: piece.side == Side.Black,
        })
    }

    loadShader(gl, type, source) {
        const shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);

            return null;
        }
        
        return shader;
    }

    drawBoard(board) {
        this.removeDrawingCommandByProperty({ tag: 'board' });
        this.removeDrawingCommandByProperty({ tag: 'piece' });
        for (let file = 1; file <= 9; file++) {
            for (let rank = 1; rank <= 9; rank++) {
                this.drawingBuffer.push({
                    tag: 'board',
                    sprite: 'board_square',
                    position: {
                        x: file - 1,
                        y: rank - 1,
                        z: 0,
                    },
                });
                let pieces = board.piecesByProperty({ file: file, rank: rank });
                if (pieces.length) {
                    let piece = pieces[0];
                    this.drawingBuffer.push({
                        tag: 'piece',
                        sprite: this.getSpriteForPiece(piece.kind),
                        position: {
                            x: file - 1,
                            y: rank - 1,
                            z: 2,
                        },
                        flipped: piece.side == Side.Black,
                    });
                }
            }
        }
    }

    getSpriteForPiece(kind) {
        return {
            [PieceKind.Pawn]: 'pawn',
            [PieceKind.King]: 'king',
            [PieceKind.Knight]: 'knight',
            [PieceKind.Rook]: 'rook',
            [PieceKind.Bishop]: 'bishop',
            [PieceKind.GoldGeneral]: 'gold_general',
            [PieceKind.SilverGeneral]: 'silver_general',
            [PieceKind.Lance]: 'lance',
        }[kind];
    }

    drawMenu() {
        this.drawingBuffer = this.drawingBuffer.concat([
            {
                tag: 'close',
                sprite: 'close_button',
                position: {
                    x: 9,
                    y: 0,
                    z: 0,
                },
            }, {
                tag: 'hand',
                sprite: 'hand_button',
                position: {
                    x: 9,
                    y: 1,
                    z: 0,
                },
            }, {
                tag: 'save',
                sprite: 'save_button',
                position: {
                    x: 9,
                    y: 2,
                    z: 0,
                },
            },
        ]);
    }

    removeDrawingCommandByProperty(property) {
        return _.remove(this.drawingBuffer, property);
    }
}

class GameState {
    constructor(game) {
        this.game = game;
    }

    run() {
        let self = this;
        return new Promise(function (resolve) {
            self.runCallback(self, resolve);
        });
    }
}

class SelectState extends GameState {
    constructor(game) {
        super(game);
    }

    start() {
        this.game.userInterface.drawMenu();
        this.game.userInterface.drawBoard(this.game.board);
        this.game.userInterface.enableSelection(this.game.turn, this.game.board);
    }

    runCallback(self, resolve) {
        document.getElementById('webgl-canvas').onclick = function () {
            const position = self.game.userInterface.gridSelected;
            const pieces = self.game.board.piecesByProperty({ side: self.game.turn, file: position.x + 1, rank: position.y + 1 });
            if (pieces.length && pieces[0].hasValidMove()) {
                resolve(new MoveState(self.game, pieces[0]));
            }
        };
    }

    exit() {
        //
    }
}

class MoveState extends GameState {
    constructor(game, piece) {
        super(game);
        this.piece = piece;
    }

    start() {
        this.game.userInterface.drawMovements(this.piece);
    }

    runCallback(self, resolve) {
        document.getElementById('webgl-canvas').onclick = function () {
            const position = self.game.userInterface.gridSelected;
            const pieces = self.game.board.piecesByProperty({ side: self.game.turn, file: position.x + 1, rank: position.y + 1 });
            if (pieces.length && pieces[0].hasValidMove()) {
                resolve(new MoveState(self.game, pieces[0]));
            }
            if (self.game.board.movePiece(self.piece, position.x + 1, position.y + 1, self.game.currentHand())) {
                self.game.nextTurn();
                resolve(new SelectState(self.game));
            }
        }
    }

    exit() {
        this.game.userInterface.removeMovements(this.piece);
    }
}

class Game {
    newGame() {
        this.board = (new Board).loadDefault();
        this.blackHand = new Hand(Side.Black);
        this.whiteHand = new Hand(Side.White);
        this.turn = Side.Black;
        this.userInterface = new UserInterface;
        this.play();
    }

    canSelectPiece(file, rank) {
        return this.board.piecesByProperty({
            file: file,
            rank: rank,
        })[0].hasValidMove();
    }

    canMakeMove(file, rank) {
        return this.selectedPiece.canMakeMove(file, rank);
    }

    selectPiece(file, rank) {
        this.selectedPiece = this.board.piecesByProperty({
            file: file,
            rank: rank,
        });
    }

    nextTurn() {
        this.turn = (this.turn == Side.Black ? Side.White : Side.Black);
    }

    currentHand() {
        return this.turn == Side.Black ? this.blackHand : this.whiteHand;
    }

    async play() {
        this.gameState = new SelectState(this);
        while (true) {
            // console.log(this);
            this.gameState.start();
            let newState = await this.gameState.run();
            this.gameState.exit();
            this.gameState = newState;
        }
    }
}

window.onload = function () {
    window.game = new Game;
    window.game.newGame();
}
