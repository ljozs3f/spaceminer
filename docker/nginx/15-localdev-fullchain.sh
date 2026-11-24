#!/bin/sh
# localdev_download stores the *.localdev.hu certificate (docker/localdev/key.crt) without its intermediate
# certificates. Browsers fetch those themselves, curl and Node do not, so before nginx starts this script
# builds the full chain from the "CA Issuers" URLs of the certificates. If that fails, the certificate is
# used on its own. A background loop rebuilds the chain and reloads nginx when the certificate is renewed.

SRC=/etc/nginx/localdev/key.crt
KEY=/etc/nginx/localdev/key.key
OUT=/etc/nginx/ssl/fullchain.crt
LOG="localdev-fullchain:"

build_chain() {
    tmp=$(mktemp -d)
    { cat "$SRC"; echo; } > "$tmp/chain.crt"
    cert=$SRC
    for i in 1 2 3; do
        url=$(openssl x509 -in "$cert" -noout -ext authorityInfoAccess 2>/dev/null \
            | sed -n 's/.*CA Issuers - URI:\(.*\)/\1/p' | head -n 1)
        [ -n "$url" ] || break
        if ! curl -fsS --max-time 10 "$url" -o "$tmp/$i.raw"; then
            echo "$LOG cannot download $url, serving the certificate without its chain"
            break
        fi
        openssl x509 -inform DER -in "$tmp/$i.raw" -out "$tmp/$i.crt" 2>/dev/null \
            || openssl x509 -in "$tmp/$i.raw" -out "$tmp/$i.crt" 2>/dev/null \
            || break
        # stop at the self-signed root: clients have it already
        subject=$(openssl x509 -in "$tmp/$i.crt" -noout -subject)
        issuer=$(openssl x509 -in "$tmp/$i.crt" -noout -issuer)
        [ "${subject#subject=}" = "${issuer#issuer=}" ] && break
        cat "$tmp/$i.crt" >> "$tmp/chain.crt"
        cert=$tmp/$i.crt
    done
    mkdir -p "$(dirname "$OUT")"
    mv "$tmp/chain.crt" "$OUT"
    rm -rf "$tmp"
    echo "$LOG $OUT has $(grep -c 'BEGIN CERTIFICATE' "$OUT") certificate(s)"
}

checksum() {
    cat "$SRC" "$KEY" 2>/dev/null | md5sum
}

watch_renewal() {
    last=$(checksum)
    while sleep 300; do
        now=$(checksum)
        if [ "$now" != "$last" ]; then
            echo "$LOG certificate renewed, reloading nginx"
            build_chain && nginx -t -q && nginx -s reload && last=$now
        fi
    done
}

build_chain
watch_renewal &
