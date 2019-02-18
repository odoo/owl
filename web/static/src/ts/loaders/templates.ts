export type TemplateLoader = () => Promise<string>;

/**
 * Load xml templates as a string.
 */
export const loadTemplates: TemplateLoader = async function(): Promise<string> {
  const result = await fetch("templates.xml");
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  return result.text();
};
