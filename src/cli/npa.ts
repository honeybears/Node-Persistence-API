#!/usr/bin/env node
import { runNPACli } from "../generator/cli";

process.exitCode = runNPACli(process.argv.slice(2));
