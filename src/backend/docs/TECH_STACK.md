# バックエンド技術スタック

対象: `src/backend`(Cloud Functions for Firebase)

## 1. 実行基盤

- **Cloud Functions for Firebase(2nd gen)**: Cloud Runベースで実行時間・メモリの制約が1st genより緩く、今後のCSV処理やシミュレーション計算の負荷増にも対応しやすい
- **Node.js LTS** + **TypeScript**
- **npm**
- **Volta**: 開発時のNode.js / npmを`package.json`の`volta`フィールドで固定する。フロントエンドと同じ組み合わせ(`node 22.23.1` / `npm 11.18.0`)にしてある

  固定が要るのは、**ロックファイルを生成するnpmのバージョンが揃わないと、CIの`npm ci`が通らない差分を作りうる**ため。固定が無い間は、シェルで有効なNodeがそのまま使われる(実際に[X10]の作業ではNode 26が使われ、CIの22と食い違っていた)。

  `engines.node`の`22`はデプロイ先のCloud Functionsランタイムを決める宣言で、こちらとは役割が違う。npmは`engines`を既定では強制しないため、宣言だけでは手元の切り替えは起きない。

  **自動で切り替わるのは、Voltaのshim(`~/.volta/bin`)がPATHで他のNodeより先に来ている場合だけ。** Homebrewなどで入れたNodeが先にあると、`volta`フィールドがあっても切り替わらない。確かめ方は次のとおりで、`which -a node` の先頭が `~/.volta/bin/node` でなければPATHの順序を直す(フロントエンドも同じ条件)。

  ```bash
  which -a node          # 先頭が ~/.volta/bin/node か
  node -v                # src/backend 内で 22.23.1 になるか
  volta run node -v      # PATHに関わらず固定が解決できるかの確認
  ```

  npm 11は依存のinstallスクリプトを既定でブロックする。`package.json`の`allowScripts`で`@firebase/util` / `protobufjs` / `fsevents`の3つを承認してあり、フロントエンドと同じ扱いに揃えている。CIの`backend`ジョブも`npm ci`の前に固定したnpmを入れ直すので、手元とCIでインストール結果が変わらない。

  **`allowScripts`はバージョンごとの承認**なので、これらのパッケージが上がると承認が外れて`npm ci`が警告を出す。Dependabotの更新後に警告が出たら、新しいバージョンで承認し直す(`npm install-scripts approve <pkg>`)。

## 2. Firebase連携

- **firebase-admin**: Firestore/Storage/Authへの管理者権限アクセス
- **firebase-functions**: HTTPSトリガー、Firestoreトリガー、Identity PlatformのBlocking Functions(ログイン通知用)

## 3. データストア/ストレージ

- **Cloud Firestore**: セキュリティルールは`firestore.rules`に定義し、[firestore-rules-review](../../../.claude/skills/firestore-rules-review/SKILL.md)スキルでユーザー単位のアクセス制御を都度確認する
- **Firebase Storage**: 現時点で用途なし。B2のCSV取込はブラウザ上でパースして数値だけをFirestoreへ保存し、**生ファイルは保管しない**方針にしたため(理由は[要件定義書](../../../docs/fire-asset-management-requirements.md) 4.2)。`storage.rules`は全拒否のままにしてある

## 4. 認証

- **Identity Platform**: TOTP型2FA・パスワードポリシーの実体([docs/auth-login-requirements.md](../../../docs/auth-login-requirements.md)参照)
- ログイン通知メールはBlocking Functions(`beforeUserSignedIn`)経由でCloud Functionsを起動し、外部メール送信サービスから送信する構成(docs/auth-login-requirements.md 3.6)
- **Resend**: ログイン通知メールの送信サービス。HTTP APIだけで送れるためSMTPクライアント(nodemailer等)を依存に加えず`fetch`で完結する。無料枠(月3,000通/日100通)は個人利用の規模に対して十分で、共有送信ドメインを使えばDNS設定なしで始められる(代わりに宛先は自アカウントの登録メールアドレスに限られる)。APIキーは`RESEND_API_KEY`としてSecret Managerに置く
  - 送信失敗でログインを止めない。Blocking Functionsは例外を投げるとサインインを拒否し、7秒を超えても失敗するため、送信は5秒で打ち切りエラーはログに残すだけにする
- 2FAリカバリーコード(docs/auth-login-requirements.md 3.3)はIdentity Platformに機能が無いためcallableで自前実装する。コードのハッシュ化はNode標準の`node:crypto`のscryptを使い、外部のハッシュライブラリは入れない
- 設定値のうち秘密でないもの(Identity PlatformのWeb APIキー)も、CIからの非対話デプロイで確実に解決できるよう`firebase-functions/params`の`defineSecret`(Secret Manager)に置く。`.env`系ファイルはリポジトリで除外しているため、そちらは使わない

## 5. バリデーション

- **zod**: フロントエンドと同じライブラリを使い、CSV取込データやFirestoreへの書き込みペイロードの検証ロジックの書き方を揃える。スキーマ自体の共有(パッケージ化)は今のところ行わず、必要になった時点で検討する

## 6. CSVパース

- **papaparse**: マネーフォワードCSV(資産残高推移/入出金明細)のパースに使用。[mf-csv-parser-check](../../../.claude/skills/mf-csv-parser-check/SKILL.md)スキルで、正常系/異常系それぞれの挙動を検証する

## 7. テスト(ユニットのみ)

- **Firebase Emulator Suite**: Firestore/Auth/Functionsをローカルで再現し、実際のFirebaseプロジェクトに影響を与えずに検証する
- **Vitest**: Cloud Functionsのユニットテスト。ユニットのみとし、E2Eは現時点では導入しない

## 8. 監視・エラー検知

- **Sentry**(`@sentry/node`): 未捕捉エラーの検知([X3](https://trello.com/c/cjBCWQsf)で導入)。Cloud Functionsの失敗はCloud Loggingを能動的に見に行かないと気づけず、既存の「送信失敗はログに残すだけで握りつぶす」設計(ログイン通知メール・お問い合わせメール)は、その失敗自体を検知する手段を持っていなかった
- 入口は`src/sentry/report.ts`の2つ。**`onCall`は使わず`onCallWithSentry`を使う** — `options`が必須で、`SENTRY_DSN`を`secrets`へ結び付け忘れた関数が「送っているつもりで送れていない」状態で通るのを防ぐため。Blocking Functionは`captureWithoutWaiting`を既存の`catch`から呼ぶ
- **`HttpsError`は原則送らない。** クライアントへ返すための制御フローであって障害ではなく、パスワード間違いや入力不備まで送ると利用者の通常操作でSentryが埋まる。**例外は`internal`と`unavailable`の2つ**([X3-4](https://trello.com/c/t8AdERPb))。リポジトリ内の`unavailable`は全箇所が本物の障害を包んでおり(認証基盤へ接続不可・Firestoreの再帰削除失敗・Identity Platformの更新失敗・Resendへの送信失敗)、利用者の通常操作は`invalid-argument`・`unauthenticated`・`failed-precondition`・`permission-denied`・`resource-exhausted`に分かれていて混ざっていない。**判別に`details.reason`を使わないのは意図的** — 理由の一覧を持つと、新しい`reason`を足したときに更新を忘れて静かに検知漏れになる。この住み分けを崩す`HttpsError`を足すときは`isExpectedFailure`も一緒に見ること
- **Blocking Functionでは送信完了を待たない。** 7秒の予算のうちログイン通知はResendで5秒を使いうるため、Sentryを新たなタイムアウト要因にしない。callableは60秒(`deleteAccount`は300秒)あるので2秒待って確実に届ける
- **callable側のflushは、同じ呼び出しで`captureWithoutWaiting`が積んだイベントも押し出す。** お問い合わせ(A11)のメール送信失敗がこれに当たり、`unavailable`を送信対象にするまでは積まれたまま誰もflushせず、インスタンス凍結で失われうる状態だった([X3-5](https://trello.com/c/EFzBJPWV))。この経路では`mailer.ts`のError(statusコードを持つ)と`HttpsError`(どのcallableかを持つ)の**2件が届くが、これは意図したもの**(2件目以降の連投は下の抑制窓が受け止める)
- **同じ種類のイベントは10分に1件しか送らない**([X3-6](https://trello.com/c/IwYiZvt3))。`sendContactMessage`(A11)は**サインイン不要で叩ける唯一のcallable**なうえ、失敗した呼び出しには実質的なレート制限がかかっていない — 宛先未設定は送信枠の確保より**前**で投げ、送信失敗は確保した枠を戻すため(`contact/functions.ts`)。**枠を戻すのは[docs/screen-requirements-public.md](../../../docs/screen-requirements-public.md) A11が明記した要件なので、監視の都合で曲げない。** 代わりに送る側で絞る。種類は`HttpsError`ならコード+`details.reason`、それ以外は例外名+メッセージで、**メッセージは`redactSensitiveText`を通してから**判定する(UIDが混ざったままだと同じ障害が利用者ごとに別の種類として通り、抑制が効かない)。**種類ごとの1件目は必ず送る** — Sentryのスパイク保護がイベントを無差別に落とすのと違い、別種の障害が同時に起きても取りこぼさない。抑制はインスタンス単位で、記録が200件を超えたら捨てて**送る側に倒れる**
- **Sentry側のレート制限は使えない。** クライアントキーごとのレート制限は[Business / Enterpriseプラン限定](https://docs.sentry.io/pricing/quotas/manage-event-stream-guide/)で、無料のDeveloperプランには無い。上の抑制窓をコード側に置いているのはこのため
- **初期化は遅延させる。** `SENTRY_DSN.value()`はモジュール読み込み時に解決できない(firebase-toolsがデプロイ前に関数定義を解析する時点ではSecret Managerの値が渡っていない)。あわせて`defaultIntegrations: false`で既定の自動計装を止めてある — OpenTelemetryの登録コストが7秒予算を削るため。**`integrations: []`では止まらない**(既定とマージされるだけ)
- **個人情報を送らない。** `sendDefaultPii: false`に加え、`beforeSend`(`src/sentry/scrub.ts`)でメールアドレス・UID・リクエストの中身を落とす。単体テストで「送られないこと」を固定してあるので、**方針を変えるときはそのテストも読むこと**
- **数字は伏せていない。** フロントエンドは残高が本文に混ざりうるため4桁以上の数字を落としているが([X3-1])、バックエンドの関数は金額を扱わない。潰すとステータスコードという切り分け材料を失うだけになる
- シークレットの登録手順は[docs/ci-cd-setup.md](../../../docs/ci-cd-setup.md) 15.6節

## 9. Lint / Format

- ESLint + Prettier(フロントエンドと同等の構成)

## 10. コスト管理

- 個人利用規模ではFirestore/Storage/Cloud Functions/Identity Platformいずれも無料枠内に収まる想定([docs/auth-login-requirements.md](../../../docs/auth-login-requirements.md) 3.1参照)
- Blazeプラン(従量課金)には自動の支出上限機能がない(廃止済み)ため、Google Cloud Billing Budgetsで月額10,000円の予算アラートを50%/90%/100%のしきい値で設定し、メール通知で異常な利用を検知する。予算超過を検知して自動的に課金を停止する仕組みは導入せず、アラート受信後は手動で原因調査・対応する
- 費用が想定外に膨らみうる主な要因は「Firestore/Storageのセキュリティルールの不備による外部からの不正アクセス」「Cloud Functionsのバグによる無限ループ的実行」「App Hostingへの頻繁なデプロイによるビルド時間消費」の3つ。セキュリティルールは[firestore-rules-review](../../../.claude/skills/firestore-rules-review/SKILL.md)スキルで都度確認する

## 11. 今後の検討事項(オープン課題)

- ログイン通知メールの独自ドメイン化(docs/auth-login-requirements.md 8章の課題と対応)
- Cloud FunctionsのNode.jsバージョン固定
- フロントエンドとのバリデーションスキーマ共有の要否
