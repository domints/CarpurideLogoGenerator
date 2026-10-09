const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.mts',
    devServer: {
        static: './dist',
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Carpuride Logo Generator',
            template: "./src/index.html",
        }),
        new CopyPlugin({
            patterns: [
                // Copy Shoelace assets to dist/shoelace
                {
                    from: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/assets'),
                    to: path.resolve(__dirname, 'dist/shoelace/assets')
                },
                {
                    from: path.resolve(__dirname, 'src/pttjpeg.js'),
                    to: path.resolve(__dirname, 'dist/pttjpeg.js')
                }
                /*{
                    from: path.resolve(__dirname, 'premium.json'),
                    to: path.resolve(__dirname, 'dist/premium.json')
                }*/
            ]
        })
    ],
    module: {
        rules: [{
            test: /\.m?tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
        {
            test: /\.(s(a|c)ss)$/,
            use: [MiniCssExtractPlugin.loader,
                "css-loader",
                "postcss-loader",
                {
                    loader: 'sass-loader',
                    options: {
                        api: 'modern-compiler', // Przełącza na nowoczesne API Sass
                    },
                },
            ]
        },
        {
            test: /\.css$/i,
            use: [MiniCssExtractPlugin.loader, 'css-loader']
        },
        ],
    },
    resolve: {
        extensions: ['.mts', '.tsx', '.ts', '.mjs', '.js'],
        extensionAlias: {
            '.mjs': ['.mts', '.mjs'],
        },
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    optimization: {
        usedExports: true,
    },
};