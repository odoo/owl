const isProduction = process.env.NODE_ENV === "production";

module.exports = {
    plugins: [
        require("postcss-preset-env"),
        require("postcss-import"),
        require("autoprefixer"),
        require("postcss-nested"),

        ...(isProduction
            ? [
                  require("@fullhuman/postcss-purgecss")({
                      // Specify the paths to all of the template files in your project
                      content: ["./public/index.html", "./src/**/*.xml"],

                      // Include any special characters you're using in this regular expression
                      defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
                  }),
              ]
            : []),
    ],
};
