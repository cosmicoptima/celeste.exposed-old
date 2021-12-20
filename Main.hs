{-# LANGUAGE OverloadedStrings #-}

module Main
  ( main
  ) where

import           Hakyll

main :: IO ()
main = hakyll $ do
  match "static/*.css" $ do
    route $ removeRoutePrefix "static/"
    compile compressCssCompiler

  match "static/*" $ do
    route $ removeRoutePrefix "static/"
    compile copyFileCompiler

  match "templates/*" $ compile templateCompiler

  match "pages/index.md" $ do
    route $ constRoute "index.html"
    compile markdownCompiler

  match "pages/*.md" $ do
    route $ noExtensionRoute "pages/"
    compile markdownCompiler

markdownCompiler :: Compiler (Item String)
markdownCompiler =
  pandocCompiler
    >>= loadAndApplyTemplate "templates/default.html" defaultContext
    >>= relativizeUrls

removeRoutePrefix :: FilePath -> Routes
removeRoutePrefix dir = gsubRoute dir (const "")

noExtensionRoute :: FilePath -> Routes
noExtensionRoute dir =
  removeRoutePrefix dir `composeRoutes` gsubRoute ".md" (const "/index.html")
