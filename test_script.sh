#!/usr/bin/env bash

SERVER=$(./cli.js instance debug | jq -r '.server')
curl https://$SERVER/on/demandware.store/Sites-nto-Site/default/Foo-Bar
