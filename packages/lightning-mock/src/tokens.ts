import * as jose from 'jose';
import crypto from 'node:crypto';

export const generateRunToken = async (
  runId: string,
  privateKey?: string
): Promise<string> => {
  if (privateKey) {
    const alg = 'RS256';

    const key = crypto.createPrivateKey(privateKey);

    const jwt = await new jose.SignJWT({ id: runId })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setIssuer('Lightning')
      .setExpirationTime('2h')
      .sign(key);

    return jwt;
  } else {
    return 'x.y.z';
  }
};

/*

// Joken.Signer.create("RS256", %{"pem" => pem})

  |> add_claim("iss", fn -> "Lightning" end, &(&1 == "Lightning"))
      |> add_claim("id", nil, fn id, _claims, context ->
        is_binary(id) and id == Map.get(context, :id)
      end)
      |> add_claim(
        "nbf",
        fn -> Lightning.current_time() |> DateTime.to_unix() end,
        fn nbf, _claims, %{current_time: current_time} ->
          current_time |> DateTime.to_unix() >= nbf
        end
      )
      |> add_claim(
        "exp",
        fn ->
          Lightning.current_time()
          |> DateTime.add(Lightning.Config.grace_period())
          |> DateTime.to_unix()
        end,
        fn exp, _claims, %{current_time: current_time} ->
          current_time |> DateTime.to_unix() < exp
        end
      )
      */
