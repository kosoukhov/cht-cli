declare module "slug" {
  interface SlugOptions {
    lower?: boolean;
    replacement?: string;
    remove?: RegExp;
    charmap?: Record<string, string>;
    multicharmap?: Record<string, string>;
  }

  function slug(input: string, options?: SlugOptions | string): string;

  export default slug;
}
