declare module "js-yaml" {
  function load(input: string): unknown;
  function dump(input: unknown): string;

  export { load, dump };
}
