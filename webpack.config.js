module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  devtool: 'source-map',
  module: {
    loaders: [
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader'
      }
    ]
  },
  entry: {
    app: "./src/app.ts",
    tests: "./test/tests.ts"
  },
  output: {
    filename: "[name].js",
  }
};
