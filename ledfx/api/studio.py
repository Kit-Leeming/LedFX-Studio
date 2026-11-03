from aiohttp import web

from ledfx.api import RestEndpoint
from ledfx.api.virtual import make_virtual_response
from ledfx.studio import Studio, color_fields


class StudioEndpoint(RestEndpoint):
    ENDPOINT_PATH = "/api/studio"

    def studio(self):
        if not hasattr(self._ledfx, "studio"):
            self._ledfx.studio = Studio(self._ledfx)
        return self._ledfx.studio

    async def get(self):
        studio = self.studio()
        return web.json_response(
            {
                "status": "success",
                "library": studio.data,
                "undo": len(studio.history),
                "virtuals": {
                    v.id: make_virtual_response(v)
                    for v in self._ledfx.virtuals.values()
                },
                "color_fields": {
                    k: color_fields(v) for k, v in self._ledfx.effects.classes().items()
                },
            }
        )

    async def put(self, body):
        try:
            self.studio().save_library(body)
            return await self.get()
        except (ValueError, KeyError, TypeError) as error:
            return await self.invalid_request(str(error), resp_code=400)

    async def post(self, body):
        try:
            studio = self.studio()
            if body.get("action") == "undo":
                studio.undo()
            elif body.get("action") == "apply":
                studio.apply(body.get("changes"))
            else:
                raise ValueError("Unknown Studio action")
            return await self.get()
        except (ValueError, KeyError, TypeError, RuntimeError) as error:
            return await self.invalid_request(str(error), resp_code=400)
