export interface TiledProperty {
  readonly name: string;
  readonly type: "string" | "int" | "float" | "bool";
  readonly value: string | number | boolean;
}

export interface TiledTile {
  readonly id: number;
  readonly properties?: readonly TiledProperty[];
}

export interface TiledTileset {
  readonly firstgid: number;
  readonly name: string;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly tilecount: number;
  readonly columns: number;
  readonly tiles?: readonly TiledTile[];
  readonly source?: string;
}

export interface TiledObject {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly name: string;
  readonly type: string;
  readonly gid?: number;
  readonly properties?: readonly TiledProperty[];
}

export interface TiledLayer {
  readonly name: string;
  readonly type: "tilelayer" | "objectgroup";
  readonly width?: number;
  readonly height?: number;
  readonly data?: readonly number[];
  readonly objects?: readonly TiledObject[];
  readonly visible: boolean;
  readonly offsetx?: number;
  readonly offsety?: number;
  readonly properties?: readonly TiledProperty[];
}

export interface TiledMap {
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly orientation: string;
  readonly layers: readonly TiledLayer[];
  readonly tilesets: readonly TiledTileset[];
  readonly properties?: readonly TiledProperty[];
}
