export type NPAAdapterName = "postgresql" | "mysql";

export interface GenerateNPAClientOptions {
  cwd: string;
  entities: string[];
  out: string;
  adapter: NPAAdapterName;
  libraryImport: string;
}

export interface ParsedEntitySource {
  className: string;
  filePath: string;
  columns: ParsedEntityColumn[];
}

export interface ParsedEntityColumn {
  propertyName: string;
  type: string;
  primary: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
}
